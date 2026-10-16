"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, getDocs, query, collection, serverTimestamp, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertTriangle, Loader2, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";
import { calculatePercentiles, estimatePercentile, type RankingAttempt } from "@/lib/mockPercentile";
import { logActivity } from "@/lib/firebase/activity";

type Mock = { id: string; name: string; type: "full" | "sectional"; section?: string; questions: number; durationMins: number; difficulty?: string; status: "published" | "draft" };
// "submitting" exists only in the running page.  It prevents an unload from
// turning a completed test into a zero while its Firestore writes finish.
type SavedAttempt = { status: "in_progress" | "submitting" | "submitted"; answers?: Record<string, string>; score?: number; total?: number; correct?: number; wrong?: number; percentile?: number; timeTakenSeconds?: number; fullMock?: boolean; scoringVersion?: number };
type ResultMessage = { source: "achievers-mock"; type: "ready" | "started" | "submitted" | "back-to-list"; score?: number; total?: number; correct?: number; wrong?: number; answers?: Record<string, string>; secondsLeft?: number; timeTakenSeconds?: number; fullMock?: boolean; repair?: boolean; percentile?: number };

function addAchieversBridge(html: string, savedAttempt?: SavedAttempt | null) {
  const restorePayload = savedAttempt?.status === "submitted"
    ? JSON.stringify({ answers: savedAttempt.answers || {}, score: savedAttempt.score || 0, percentile: savedAttempt.percentile, timeTakenSeconds: savedAttempt.timeTakenSeconds || 0, fullMock: savedAttempt.fullMock === true }).replace(/<\//g, "<\\/")
    : "null";
  // Keep the regular-expression escapes intact in the script injected into
  // the uploaded HTML. A normal template literal consumes escapes such as
  // `\\s` and `\\/`, producing invalid JavaScript inside the iframe.
  const bridge = String.raw`<script>
    (function () {
      var sent = false;
      var latestPercentile = null;
      function send(type, extra) { window.parent.postMessage(Object.assign({ source: 'achievers-mock', type: type }, extra || {}), '*'); }
      function showPercentile(percentile) {
        var value = Number(percentile);
        if (!isFinite(value)) return;
        latestPercentile = value;
        var title = document.querySelector('#result-screen h1, #result-screen h2, #result-screen [class*="title" i], .result-screen h1, .result-screen h2, .result-screen [class*="title" i]');
        if (!title) {
          var titles = document.querySelectorAll('h1, h2, h3, [class*="title" i]');
          for (var titleIndex = 0; titleIndex < titles.length; titleIndex++) {
            if (/mock|performance report|results/i.test((titles[titleIndex].textContent || '').trim())) { title = titles[titleIndex]; break; }
          }
        }
        if (!title) return;
        var badge = document.getElementById('achievers-percentile-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'achievers-percentile-badge';
          badge.style.cssText = 'display:inline-flex;align-items:center;margin-left:12px;vertical-align:middle;border-radius:999px;background:#e8f8ee;color:#08783f;padding:5px 10px;font:700 14px Arial,sans-serif;white-space:nowrap;';
          title.style.display = 'inline-block';
          title.insertAdjacentElement('afterend', badge);
        }
        var text = value.toFixed(2) + '%ile';
        if (badge.textContent !== text) badge.textContent = text;
      }
      function isLegacyMultiSectionMock() {
        if (typeof TEST_META !== 'undefined') return false;
        var text = (document.body && document.body.textContent || '').toUpperCase();
        return text.indexOf('VARC') !== -1 && text.indexOf('DILR') !== -1 && text.indexOf('QA') !== -1;
      }
      function reportLegacyFullMockResult() {
        if (sent || !isLegacyMultiSectionMock()) return false;
        var result = document.getElementById('result-screen') || document.querySelector('[id*="result" i], [class*="result" i]');
        if (!result || getComputedStyle(result).display === 'none') return false;
        var text = (result.textContent || '').replace(/\s+/g, ' ');
        if (!/section performance/i.test(text) || !/VARC/i.test(text) || !/DILR/i.test(text) || !/QA/i.test(text)) return false;
        var scoreMatch = null, scorePattern = /(-?\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*(?:MARKS?|NET SCORE)?/gi, match;
        while ((match = scorePattern.exec(text))) {
          if (!scoreMatch || Number(match[2]) > Number(scoreMatch[2])) scoreMatch = match;
        }
        if (!scoreMatch || Number(scoreMatch[2]) < 9) return false;
        var correctMatch = text.match(/(\d+)\s*CORRECT/i), wrongMatch = text.match(/(\d+)\s*WRONG/i);
        // Legacy full mocks reach this combined-result path directly, rather
        // than reportResult(). Add the same in-site question review control
        // before marking the result as reported.
        addLegacyReviewButton();
        sent = true;
        send('submitted', {
          score: Number(scoreMatch[1]), total: Math.round(Number(scoreMatch[2]) / 3),
          correct: correctMatch ? Number(correctMatch[1]) : 0, wrong: wrongMatch ? Number(wrongMatch[1]) : 0,
          answers: typeof answers !== 'undefined' ? answers : {}, timeTakenSeconds: 0, fullMock: true
        });
        return true;
      }
      function addLegacyReviewButton() {
        if (!getReviewSections().length || document.getElementById('achievers-legacy-review')) return;
        var result = document.getElementById('result-screen') || document.querySelector('[id*="result" i], [class*="result" i]');
        if (!result) return;
        var button = document.createElement('button');
        button.id = 'achievers-legacy-review';
        button.type = 'button';
        button.textContent = 'Review Questions';
        button.style.cssText = 'margin:16px auto;display:block;border:0;border-radius:8px;background:#1976b9;color:white;padding:11px 20px;font:600 14px Arial,sans-serif;cursor:pointer;';
        button.onclick = openLegacyReview;
        result.appendChild(button);
      }
      function getReviewSections() {
        var sections = [];
        var addSection = function (id, label, questions) {
          if (!Array.isArray(questions) || !questions.length) return;
          sections.push({ id: id == null ? '' : id, label: label || '', questions: questions });
        };
        // Full mocks normally declare the sections explicitly. Some older
        // SIMCAT exports only expose QUESTION_BANK, so fall back to every
        // non-empty question array in that bank instead of hiding review.
        if (typeof QUESTION_BANK !== 'undefined') {
          var ids = typeof FULL_MOCK_SECTIONS !== 'undefined' && Array.isArray(FULL_MOCK_SECTIONS)
            ? FULL_MOCK_SECTIONS
            : Object.keys(QUESTION_BANK);
          ids.forEach(function (testId, sectionIndex) {
            var label = '';
            if (typeof FULL_MOCK_LABELS !== 'undefined' && FULL_MOCK_LABELS[sectionIndex]) label = FULL_MOCK_LABELS[sectionIndex];
            else if (typeof TEST_META !== 'undefined' && Array.isArray(TEST_META)) {
              var meta = TEST_META.filter(function (item) { return String(item.id) === String(testId); })[0];
              label = meta && (meta.label || meta.name || meta.section);
            }
            addSection(testId, label || ('Section ' + (sectionIndex + 1)), QUESTION_BANK[testId]);
          });
        }
        if (!sections.length && typeof QUESTIONS !== 'undefined') addSection('', '', QUESTIONS);
        return sections;
      }
      function openLegacyReview() {
        var existing = document.getElementById('achievers-legacy-review-modal');
        if (existing) { existing.style.display = 'flex'; return; }
        var modal = document.createElement('div');
        modal.id = 'achievers-legacy-review-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:hidden;background:#f1f5f9;font-family:Arial,sans-serif;display:flex;flex-direction:column;';
        var escapeHtml = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var sections = getReviewSections();
        if (!sections.length) return;
        // Flatten all questions into a single list with section info
        var allQuestions = [];
        sections.forEach(function (section) {
          section.questions.forEach(function (question, index) {
            var sectionResult = typeof fullMockSectionResults !== 'undefined' ? fullMockSectionResults.filter(function (r) { return r.testId === section.id; })[0] : null;
            var answer = sectionResult && sectionResult.answers ? sectionResult.answers[index] : (typeof answers !== 'undefined' ? (section.id && answers[section.id + ':' + index] !== undefined ? answers[section.id + ':' + index] : answers[index]) : undefined);
            var correct = question.correct == null ? '' : String(question.correct);
            var answered = answer !== undefined && answer !== '';
            var isCorrect = answered && String(answer).trim() === correct.trim();
            // Passage / set context — try every field name used by CAT mock exports
            var passageText = question.passage || question.para || question.comprehension || question.passageText || question.passage_text || question.comprehensionText || question.context || question.directions || question.setInfo || question.caseStudy || question.set || question.intro || question.paragraph || question.case || question.stimulus || '';
            // Normalise: strip lone whitespace / empty strings
            if (passageText && !passageText.trim()) passageText = '';
            // Stable key: use explicit id when available, else first 120 chars of text
            var passageKey = question.passageId || question.setId || question.groupId || question.pid || question.paragraphId || (passageText ? passageText.trim().substring(0, 120) : '');
            // Detect label — RC vs DILR heuristic based on section name
            var passageLabel = /dilr|di|lr|data/i.test(section.label) ? 'Set Information' : 'Reading Passage';
            allQuestions.push({ question: question, index: index, sectionLabel: section.label, answer: answer, correct: correct, answered: answered, isCorrect: isCorrect, passageText: passageText, passageKey: passageKey, passageLabel: passageLabel });
          });
        });
        var currentIndex = 0;
        function getPaletteBg(item) {
          if (!item.answered) return '#e2e8f0';
          return item.isCorrect ? '#dcfce7' : '#fee2e2';
        }
        function getPaletteColor(item) {
          if (!item.answered) return '#475569';
          return item.isCorrect ? '#15803d' : '#b91c1c';
        }
        function renderQuestion(idx) {
          var item = allQuestions[idx];
          var q = item.question;
          var prompt = q.text || q.question || q.questionText || ('Question ' + (item.index + 1));
          var explanation = q.solution || q.explanation || q.rationale || 'No written explanation was included in this uploaded mock.';
          var statusColor = !item.answered ? '#64748b' : (item.isCorrect ? '#15803d' : '#b91c1c');
          var statusText = !item.answered ? 'Not Attempted' : (item.isCorrect ? '\u2713 Correct' : '\u2717 Incorrect');
          var statusBg = !item.answered ? '#f1f5f9' : (item.isCorrect ? '#dcfce7' : '#fee2e2');
          var statusBorder = !item.answered ? '#e2e8f0' : (item.isCorrect ? '#86efac' : '#fca5a5');
          var optionsHtml = '';
          if (q.options && q.options.length) {
            optionsHtml = '<div style="margin-top:16px;">';
            q.options.forEach(function (option, optionIndex) {
              var value = typeof option === 'object' ? (option.num || option.value || optionIndex + 1) : optionIndex + 1;
              var label = typeof option === 'object' ? (option.text || option.label || value) : option;
              var isYours = item.answered && String(item.answer).trim() === String(value).trim();
              var isCorrectOpt = String(item.correct).trim() === String(value).trim();
              var bg = isCorrectOpt ? '#dcfce7' : (isYours && !isCorrectOpt ? '#fee2e2' : '#fff');
              var border = isCorrectOpt ? '1.5px solid #15803d' : (isYours && !isCorrectOpt ? '1.5px solid #b91c1c' : '1px solid #e2e8f0');
              var indicator = isCorrectOpt ? ' \u2713' : (isYours && !isCorrectOpt ? ' \u2717' : '');
              var iColor = isCorrectOpt ? '#15803d' : '#b91c1c';
              optionsHtml += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;margin-bottom:8px;background:' + bg + ';border:' + border + ';"><span style="min-width:22px;font-weight:700;color:#475569;">' + value + '.</span><span style="flex:1;line-height:1.5;color:#1e293b;">' + label + '</span><span style="font-weight:700;color:' + iColor + ';">' + indicator + '</span></div>';
            });
            optionsHtml += '</div>';
          }
          var body = document.getElementById('achievers-review-qbody');
          // Passage / set context block
          var passageHtml = '';
          if (item.passageText) {
            // Detect if this is same passage as adjacent question (collapse by default if same)
            var prevKey = idx > 0 ? allQuestions[idx - 1].passageKey : null;
            var isSameAsLast = prevKey && prevKey === item.passageKey;
            var passageId = 'achievers-passage-' + idx;
            var btnId = 'achievers-passage-toggle-' + idx;
            // Always show inline; collapsed state controlled by max-height toggle
            passageHtml = '<div style="margin-bottom:16px;border-radius:10px;border:1px solid #bfdbfe;background:#eff6ff;overflow:hidden;">'
              + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;cursor:pointer;user-select:none;" onclick="var b=document.getElementById(\'' + passageId + '\');var t=document.getElementById(\'' + btnId + '\');if(b.style.display===\'none\'){b.style.display=\'block\';t.textContent=\'Hide ▲\';}else{b.style.display=\'none\';t.textContent=\'Show ▼\';}">'
              + '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1d4ed8;">' + escapeHtml(item.passageLabel) + (isSameAsLast ? ' (same as previous)' : '') + '</span>'
              + '<button id="' + btnId + '" type="button" style="border:0;background:transparent;font-size:12px;font-weight:700;color:#1d4ed8;cursor:pointer;padding:0;">'
              + (isSameAsLast ? 'Show ▼' : 'Hide ▲') + '</button>'
              + '</div>'
              + '<div id="' + passageId + '" style="padding:0 16px 16px;line-height:1.85;color:#1e293b;font-size:14px;display:' + (isSameAsLast ? 'none' : 'block') + ';">'
              + item.passageText
              + '</div></div>';
          }
          body.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">'
            + '<div><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">' + escapeHtml(item.sectionLabel || '') + '</span>'
            + '<h3 style="margin:4px 0 0;font-size:17px;font-weight:700;color:#0f172a;">Question ' + (idx + 1) + ' <span style="color:#94a3b8;font-size:14px;font-weight:400;">of ' + allQuestions.length + '</span></h3></div>'
            + '<span style="padding:5px 14px;border-radius:999px;font-size:13px;font-weight:700;background:' + statusBg + ';color:' + statusColor + ';border:1px solid ' + statusBorder + ';">' + statusText + '</span>'
            + '</div>'
            + passageHtml
            + '<div style="line-height:1.75;color:#1e293b;font-size:15px;padding:16px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;">' + prompt + '</div>'
            + optionsHtml
            + '<div style="margin-top:20px;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">'
            + '<div style="display:flex;gap:40px;flex-wrap:wrap;">'
            + '<div><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.05em;">Your Response</p><p style="margin:0;font-size:16px;font-weight:700;color:' + statusColor + ';">' + (item.answered ? escapeHtml(item.answer) : '\u2014') + '</p></div>'
            + '<div><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.05em;">Correct Answer</p><p style="margin:0;font-size:16px;font-weight:700;color:#15803d;">' + escapeHtml(item.correct) + '</p></div>'
            + '<div style="margin-left:auto;"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.05em;">Result</p><p style="margin:0;font-size:16px;font-weight:700;color:' + statusColor + ';">' + (item.answered ? (item.isCorrect ? 'Correct' : 'Incorrect') : 'Not Attempted') + '</p></div>'
            + '</div></div>'
            + '<div style="margin-top:20px;padding:16px 18px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;">'
            + '<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.06em;">Solution &amp; Explanation</p>'
            + '<div style="line-height:1.75;color:#1e293b;font-size:14px;">' + explanation + '</div>'
            + '</div>';
          // Update palette highlight
          var paletteBtns = document.querySelectorAll('.achievers-palette-btn');
          for (var pi = 0; pi < paletteBtns.length; pi++) {
            var isActive = pi === idx;
            paletteBtns[pi].style.outline = isActive ? '2.5px solid #1976b9' : 'none';
            paletteBtns[pi].style.outlineOffset = '2px';
            paletteBtns[pi].style.transform = isActive ? 'scale(1.12)' : 'scale(1)';
          }
          // Scroll active palette button into view
          var activeBtn = document.querySelector('.achievers-palette-btn[data-qidx="' + idx + '"]');
          if (activeBtn && activeBtn.scrollIntoView) activeBtn.scrollIntoView({ block: 'nearest' });
          // Update nav buttons
          var prevBtn = document.getElementById('achievers-prev-btn');
          var nextBtn = document.getElementById('achievers-next-btn');
          prevBtn.disabled = idx === 0;
          prevBtn.style.opacity = idx === 0 ? '.35' : '1';
          prevBtn.style.cursor = idx === 0 ? 'not-allowed' : 'pointer';
          nextBtn.disabled = idx === allQuestions.length - 1;
          nextBtn.style.opacity = idx === allQuestions.length - 1 ? '.35' : '1';
          nextBtn.style.cursor = idx === allQuestions.length - 1 ? 'not-allowed' : 'pointer';
          var counter = document.getElementById('achievers-review-counter');
          if (counter) counter.textContent = (idx + 1) + ' / ' + allQuestions.length;
        }
        // Build palette HTML
        var paletteHtml = '<div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;flex-shrink:0;"><p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Choose a Question</p></div>';
        paletteHtml += '<div style="flex:1;overflow-y:auto;padding:10px 12px;">';
        var sectionStart = 0;
        sections.forEach(function (section) {
          if (section.label) paletteHtml += '<p style="margin:8px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#1976b9;letter-spacing:.05em;">' + escapeHtml(section.label) + '</p>';
          paletteHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
          section.questions.forEach(function (q, qi) {
            var gIdx = sectionStart + qi;
            var item = allQuestions[gIdx];
            paletteHtml += '<button class="achievers-palette-btn" data-qidx="' + gIdx + '" type="button" style="width:34px;height:34px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:' + getPaletteBg(item) + ';color:' + getPaletteColor(item) + ';transition:transform .1s,outline .1s;">' + (gIdx + 1) + '</button>';
          });
          paletteHtml += '</div>';
          sectionStart += section.questions.length;
        });
        paletteHtml += '</div>';
        // Legend
        paletteHtml += '<div style="padding:10px 14px;border-top:1px solid #e2e8f0;flex-shrink:0;font-size:11px;color:#64748b;">'
          + '<p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Legend</p>'
          + '<div style="display:flex;flex-direction:column;gap:5px;">'
          + '<span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#dcfce7;border:1px solid #86efac;vertical-align:middle;margin-right:5px;"></span>Correct</span>'
          + '<span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#fee2e2;border:1px solid #fca5a5;vertical-align:middle;margin-right:5px;"></span>Incorrect</span>'
          + '<span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#e2e8f0;vertical-align:middle;margin-right:5px;"></span>Not Attempted</span>'
          + '</div></div>';
        modal.innerHTML =
          // Top bar
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#fff;border-bottom:1px solid #e2e8f0;gap:12px;flex-shrink:0;">'
          + '<div><h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Review Questions</h2><p style="margin:2px 0 0;font-size:12px;color:#64748b;">Your responses, correct answers, and explanations</p></div>'
          + '<button type="button" id="achievers-close-review" style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:7px 14px;cursor:pointer;font-weight:700;font-size:13px;color:#0f172a;">&larr; Back to Analysis</button>'
          + '</div>'
          // Body: question pane + palette
          + '<div style="display:flex;flex:1;min-height:0;overflow:hidden;">'
          + '<div id="achievers-review-qbody" style="flex:1;overflow-y:auto;padding:24px 28px;"></div>'
          + '<div style="width:210px;flex-shrink:0;border-left:1px solid #e2e8f0;background:#fff;display:flex;flex-direction:column;overflow:hidden;">' + paletteHtml + '</div>'
          + '</div>'
          // Bottom nav
          + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#fff;border-top:1px solid #e2e8f0;flex-shrink:0;gap:12px;">'
          + '<button type="button" id="achievers-prev-btn" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;font-size:13px;color:#0f172a;">&larr; Previous</button>'
          + '<span id="achievers-review-counter" style="font-size:13px;color:#64748b;font-weight:600;"></span>'
          + '<button type="button" id="achievers-next-btn" style="border:0;background:#1976b9;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;font-size:13px;color:#fff;">Next &rarr;</button>'
          + '</div>';
        document.body.appendChild(modal);
        document.getElementById('achievers-close-review').onclick = function () { modal.remove(); };
        document.getElementById('achievers-prev-btn').onclick = function () { if (currentIndex > 0) { currentIndex--; renderQuestion(currentIndex); } };
        document.getElementById('achievers-next-btn').onclick = function () { if (currentIndex < allQuestions.length - 1) { currentIndex++; renderQuestion(currentIndex); } };
        modal.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest && e.target.closest('.achievers-palette-btn');
          if (btn) { currentIndex = parseInt(btn.getAttribute('data-qidx'), 10); renderQuestion(currentIndex); }
        });
        renderQuestion(0);
      }
      function reportResult() {
        // Older full-mock files expose one section through QUESTIONS while
        // the student is progressing. Wait for their combined result screen.
        if (sent || isLegacyMultiSectionMock() || typeof QUESTIONS === 'undefined' || typeof answers === 'undefined') return;
        sent = true;
        // Do not reuse the legacy page's displayed totals here. Some of the
        // old files count an incorrect TITA response as correct because it
        // carries no negative mark. It is still an incorrect response: it
        // earns zero, and must not increase either marks or accuracy.
        var correct = 0, wrong = 0, wrongMCQ = 0, score = 0;
        QUESTIONS.forEach(function (q, index) {
          var answer = answers[index];
          if (answer === undefined || answer === null || String(answer).trim() === '') return;
          var isCorrect = String(answer).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
          if (isCorrect) { correct++; score += 3; }
          else {
            wrong++;
            if (String(q.q_type || q.qType || '').toUpperCase() === 'MCQ') { wrongMCQ++; score -= 1; }
          }
        });
        correctLegacyResultDisplay(score, correct, wrong, wrongMCQ, QUESTIONS.length);
        addLegacyReviewButton();
        send('submitted', { score: score, total: QUESTIONS.length, correct: correct, wrong: wrong, answers: answers, secondsLeft: typeof secsLeft === 'number' ? secsLeft : 0, repair: window.__achieversAnalysis === true });
      }
      function correctLegacyResultDisplay(score, correct, wrong, wrongMCQ, total) {
        // Legacy result pages are rendered by the uploaded HTML. Correct the
        // two aggregate values after it renders so the student sees the same
        // CAT score that is saved in Firestore. This is intentionally narrow:
        // detailed question review remains authored by the uploaded mock.
        var result = document.getElementById('result-screen');
        if (!result || typeof QUESTIONS === 'undefined') return;
        var scoreNode = result.querySelector('.score-big');
        if (scoreNode) scoreNode.innerHTML = String(score) + '<span style="font-size:24px;opacity:.7">/' + (total * 3) + '</span>';
        var correctNode = result.querySelector('.stats-row .stat-box:nth-child(1) .sv');
        var wrongNode = result.querySelector('.stats-row .stat-box:nth-child(2) .sv');
        if (correctNode) correctNode.textContent = String(correct);
        if (wrongNode) wrongNode.textContent = String(wrong);
        var wrongLabel = result.querySelector('.stats-row .stat-box:nth-child(2) .sl');
        if (wrongLabel) wrongLabel.textContent = 'Incorrect (' + wrongMCQ + ' MCQ · −' + wrongMCQ + ')';
        Array.prototype.forEach.call(result.querySelectorAll('.perf-item'), function (item) {
          var label = (item.firstElementChild && item.firstElementChild.textContent || '').trim();
          var value = item.querySelector('b');
          if (!value) return;
          if (/^Net Marks$/i.test(label)) value.textContent = score + ' / ' + (total * 3);
          if (/^Questions Attempted$/i.test(label)) value.textContent = (correct + wrong) + ' / ' + total;
          if (/^Accuracy \(attempted\)$/i.test(label)) value.textContent = (correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0) + '%';
        });
      }
      function reportVisibleResult() {
        if (sent) return;
        // Legacy full-mock pages have no machine-readable result object.
        // Their complete combined result is safe to read, including while an
        // existing attempt is reopened for analysis.
        if (reportLegacyFullMockResult()) return;
        // Reopened analyses have saved answers, which let the dedicated
        // reporters calculate the exact score. Do not replace it with a
        // value scraped from a partially rendered result screen.
        if (window.__achieversAnalysis === true) return;
        // CAT-style templates expose exact scores through their result
        // functions. Their DOM renders in stages, so scraping it here could
        // capture a partial value before final net marks are shown.
        if (typeof TEST_META !== 'undefined') return;
        var candidates = document.querySelectorAll('[data-score], #score, [id*="score" i], [class*="score" i], [id*="result" i], [class*="result" i]');
        for (var index = 0; index < candidates.length; index++) {
          var candidate = candidates[index];
          if (getComputedStyle(candidate).display === 'none' || getComputedStyle(candidate).visibility === 'hidden') continue;
          var text = (candidate.textContent || '').trim();
          var match = text.match(/(?:score|marks?)[^0-9-]*(-?[0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+))?/i) || text.match(/(-?[0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)[\s\S]{0,80}?(?:net marks|score)/i);
          if (!match) continue;
          sent = true;
          addLegacyReviewButton();
          send('submitted', { score: Number(match[1]), total: typeof QUESTIONS !== 'undefined' ? QUESTIONS.length : (match[2] ? Math.round(Number(match[2]) / 3) : 0), correct: 0, wrong: 0, answers: typeof answers !== 'undefined' ? answers : {}, secondsLeft: typeof secsLeft === 'number' ? secsLeft : 0 });
          return;
        }
      }
      function reportNewMockResult(savedResult) {
        // A full mock saves each section internally. Those are progress
        // checkpoints, not completed platform attempts.
        if (sent || window.__achieversAnalysis === true || (typeof fullMockActive !== 'undefined' && fullMockActive) || typeof TEST_META === 'undefined' || (!savedResult && typeof loadAllResults !== 'function')) return;
        var testId = typeof currentTestId !== 'undefined' && currentTestId ? currentTestId : (TEST_META[0] && TEST_META[0].id);
        // Sandboxed srcDoc files cannot always access localStorage. The new
        // mock hands the complete result to saveResult(), so prefer that
        // value and only use localStorage as a fallback for normal pages.
        var result = savedResult || (testId ? loadAllResults()[testId] : null);
        if (!result) return;
        sent = true;
        send('submitted', {
          score: Number(result.marks || 0),
          total: Number(result.total || (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[testId] ? QUESTION_BANK[testId].length : 0)),
          correct: Number(result.correct || 0),
          wrong: Number(result.wrong || 0),
          answers: result.answers || {},
          secondsLeft: 0,
          timeTakenSeconds: Number(result.timeUsedSec || 0)
        });
      }
      function reportNewMockState() {
        if (sent || (typeof fullMockActive !== 'undefined' && fullMockActive) || typeof TEST_META === 'undefined' || typeof answers === 'undefined') return;
        var testId = typeof currentTestId !== 'undefined' && currentTestId ? currentTestId : (TEST_META[0] && TEST_META[0].id);
        var questions = typeof currentQuestions === 'function' ? currentQuestions() : (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[testId] ? QUESTION_BANK[testId] : []);
        if (!questions || !questions.length) return;
        var correct = 0, wrong = 0, score = 0;
        questions.forEach(function (question, index) {
          var answer = answers[index];
          if (answer === undefined || answer === '') return;
          var isCorrect = String(answer).trim().toLowerCase() === String(question.correct).trim().toLowerCase();
          if (isCorrect) { correct++; score += 3; }
          else { wrong++; if (String(question.qType || question.q_type || '').toUpperCase() === 'MCQ') score -= 1; }
        });
        sent = true;
        send('submitted', {
          score: score, total: questions.length, correct: correct, wrong: wrong, answers: answers,
          timeTakenSeconds: typeof timerStartedAt === 'number' && timerStartedAt ? Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000)) : 0,
          repair: window.__achieversAnalysis === true
        });
      }
      function restoreNewMockResult(data) {
        if (data && data.fullMock && typeof FULL_MOCK_SECTIONS !== 'undefined' && typeof showFullMockResults === 'function') {
          fullMockSectionResults = FULL_MOCK_SECTIONS.map(function (testId, sectionIndex) {
            var questions = (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[testId]) || [];
            var sectionAnswers = {};
            var correct = 0, wrong = 0, wrongMCQ = 0, wrongTITA = 0, skip = 0;
            questions.forEach(function (question, index) {
              var answer = (data.answers || {})[String(testId) + ':' + index];
              if (answer === undefined || answer === '') { skip++; return; }
              sectionAnswers[index] = answer;
              if (String(answer).trim() === String(question.correct).trim()) correct++;
              else { wrong++; if (question.qType === 'MCQ') wrongMCQ++; else wrongTITA++; }
            });
            return { si: sectionIndex, testId: testId, label: (typeof FULL_MOCK_LABELS !== 'undefined' && FULL_MOCK_LABELS[sectionIndex]) || ('Section ' + (sectionIndex + 1)), correct: correct, wrong: wrong, wrongMCQ: wrongMCQ, wrongTITA: wrongTITA, skip: skip, total: questions.length, marks: correct * 3 - wrongMCQ, maxMarks: questions.length * 3, usedSecs: 0, answers: sectionAnswers, questionTimeSec: {} };
          });
          fullMockActive = false;
          showFullMockResults();
          return true;
        }
        if (typeof TEST_META === 'undefined' || !TEST_META[0] || typeof renderResultScreen !== 'function' || typeof showScreen !== 'function') return false;
        var testId = TEST_META[0].id;
        var questions = typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[testId] ? QUESTION_BANK[testId] : [];
        var restoredAnswers = data.answers || {};
        var correct = 0, wrong = 0, wrongMCQ = 0, wrongTITA = 0, skip = 0;
        questions.forEach(function (question, index) {
          var answer = restoredAnswers[index];
          if (answer === undefined || answer === '') { skip++; return; }
          if (String(answer).trim() === String(question.correct).trim()) correct++;
          else { wrong++; if (question.qType === 'MCQ') wrongMCQ++; else wrongTITA++; }
        });
        currentTestId = testId;
        answers = restoredAnswers;
        if (typeof clearInterval === 'function' && typeof timerInt !== 'undefined') clearInterval(timerInt);
        renderResultScreen(testId, {
          marks: correct * 3 - wrongMCQ, correct: correct, wrong: wrong,
          wrongMCQ: wrongMCQ, wrongTITA: wrongTITA, skip: skip, mm: 0, ss: 0,
          timeUsedSec: Number(data.timeTakenSeconds || 0), questionTimeSec: {}
        });
        showScreen('result-screen');
        return true;
      }
      function hideIntroForAnalysis() {
        var intro = document.querySelectorAll('#start-screen, #welcome-screen, #instructions-screen, #intro-screen, [data-screen="start"], [data-screen="intro"], [class*="instructions" i], [class*="rules" i]');
        intro.forEach(function (element) { element.style.display = 'none'; });
        Array.prototype.forEach.call(document.querySelectorAll('button, a'), function (control) {
          if (!/start exam/i.test((control.textContent || '').trim())) return;
          var container = control.closest('[id*="start" i], [class*="start" i], [id*="intro" i], [class*="intro" i]');
          if (container) container.style.display = 'none';
        });
      }
      function installNewMockHooks() {
        if (typeof TEST_META === 'undefined') return false;
        if (typeof showFullMockResults === 'function' && !showFullMockResults.__achieversHooked) {
          var originalShowFullMockResults = showFullMockResults;
          window.showFullMockResults = function () {
            var value = originalShowFullMockResults.apply(this, arguments);
            // The result screen is also rebuilt when a completed mock is
            // reopened for analysis. Attach the review action every time the
            // combined result renders; the helper prevents duplicates.
            addLegacyReviewButton();
            if (!sent && typeof fullMockSectionResults !== 'undefined') {
              var score = 0, total = 0, correct = 0, wrong = 0, timeTakenSeconds = 0, allAnswers = {};
              fullMockSectionResults.forEach(function (sectionResult) {
                score += Number(sectionResult.marks || 0);
                total += Number(sectionResult.total || 0);
                correct += Number(sectionResult.correct || 0);
                wrong += Number(sectionResult.wrong || 0);
                timeTakenSeconds += Number(sectionResult.usedSecs || 0);
                Object.keys(sectionResult.answers || {}).forEach(function (index) { allAnswers[String(sectionResult.testId) + ':' + index] = sectionResult.answers[index]; });
              });
              if (fullMockSectionResults.length && total) {
                sent = true;
                send('submitted', { score: score, total: total, correct: correct, wrong: wrong, answers: allAnswers, timeTakenSeconds: timeTakenSeconds, fullMock: true });
              }
            }
            return value;
          };
          window.showFullMockResults.__achieversHooked = true;
        }
        if (typeof showResults === 'function' && !showResults.__achieversHooked) {
          var originalShowResults = showResults;
          window.showResults = function () {
            var value = originalShowResults.apply(this, arguments);
            reportNewMockResult();
            return value;
          };
          window.showResults.__achieversHooked = true;
        }
        if (typeof saveResult === 'function' && !saveResult.__achieversHooked) {
          var originalSaveResult = saveResult;
          window.saveResult = function () {
            var value = originalSaveResult.apply(this, arguments);
            reportNewMockResult(arguments[1]);
            return value;
          };
          window.saveResult.__achieversHooked = true;
        }
        return typeof saveResult === 'function';
      }
      // The supplied mock files do not all place their scripts in the same
      // part of the document. Install immediately and keep trying briefly so
      // the save hook is always in place before a student can submit.
      if (!installNewMockHooks()) {
        var hookAttempts = 0;
        var hookTimer = setInterval(function () {
          hookAttempts++;
          if (installNewMockHooks() || hookAttempts >= 100) clearInterval(hookTimer);
        }, 50);
      }
      document.addEventListener('DOMContentLoaded', function () {
        // New sectional files expose a complete test-list/result application,
        // while older files expose QUESTIONS + showResults. Hook the new
        // app's result function without changing either uploaded source file.
        installNewMockHooks();
        var result = document.getElementById('result-screen');
        if (result) new MutationObserver(function () {
          if (getComputedStyle(result).display !== 'none') {
            // This also covers older full-mock exports whose final-result
            // function has a non-standard name, so their review button is
            // not dependent on a specific template implementation.
            addLegacyReviewButton();
            if (!reportLegacyFullMockResult()) { reportResult(); reportNewMockResult(); reportNewMockState(); reportVisibleResult(); }
          }
        }).observe(result, { attributes: true, attributeFilter: ['style'] });
        var percentileRenderQueued = false;
        new MutationObserver(function () {
          var visibleResult = document.getElementById('result-screen');
          if (visibleResult && getComputedStyle(visibleResult).display !== 'none') addLegacyReviewButton();
          reportVisibleResult();
          // Full Mock 12 replaces its result header after restoring the
          // report. Re-attach the badge after that render settles.
          if (latestPercentile !== null && !percentileRenderQueued) {
            percentileRenderQueued = true;
            setTimeout(function () { percentileRenderQueued = false; showPercentile(latestPercentile); }, 0);
          }
        }).observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
        document.addEventListener('click', function (event) {
          var control = event.target && event.target.closest && event.target.closest('button, [role="button"], input[type="submit"]');
          var label = (control && (control.textContent || control.value) || '').trim();
          if (/back to test list/i.test(label)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            send('back-to-list');
            return;
          }
          if (/start|begin|attempt/i.test(label)) send('started');
          if (/submit|finish|end test|view result/i.test(label)) setTimeout(function () {
            addLegacyReviewButton();
            if (!reportLegacyFullMockResult()) { reportResult(); reportNewMockResult(); reportNewMockState(); reportVisibleResult(); }
          }, 600);
        }, true);
        // The parent also sends this payload by postMessage, but embedding it
        // makes reopening analysis deterministic even if that message arrives
        // before the uploaded mock has registered its listener.
        if (window.__achieversRestorePayload) {
          setTimeout(function () {
            window.__achieversAnalysis = true;
            var restored = restoreNewMockResult(window.__achieversRestorePayload);
            // Result renderers frequently replace their heading markup, so
            // attach after the restored screen has finished rendering.
            setTimeout(function () { showPercentile(window.__achieversRestorePayload.percentile); }, 0);
            if (!restored && typeof showResults === 'function') {
              answers = window.__achieversRestorePayload.answers || {};
              submitted = true;
              showResults();
            }
          }, 0);
        }
        send('ready');
      });
      window.addEventListener('message', function (event) {
        var data = event.data || {};
        if (data.source !== 'achievers-platform') return;
        if (data.type === 'percentile') {
          showPercentile(data.percentile);
          return;
        }
        if (data.type === 'restore' && data.answers) {
          window.__achieversAnalysis = true;
          if (restoreNewMockResult(data)) {
            setTimeout(function () { showPercentile(data.percentile); }, 0);
            return;
          }
          if (typeof showResults === 'function') {
            answers = data.answers;
            submitted = true;
            if (typeof clearInterval === 'function' && typeof timerInt !== 'undefined') clearInterval(timerInt);
            hideIntroForAnalysis();
            showResults();
          }
          setTimeout(function () { showPercentile(data.percentile); }, 0);
        }
      });
    })();
  </script>`;
  return html
    .replace("function startExam() {", "function startExam() { window.parent.postMessage({ source: 'achievers-mock', type: 'started' }, '*');")
    // Newer CAT-style templates persist their completed result through this
    // function. Injecting here is deterministic: it runs with the exact
    // scored result before the template renders its result screen.
    // Uploaded mock files are authored independently and may contain spaces
    // or line breaks in this function declaration. Match the declaration,
    // not one exact formatting style, so every CAT-style template reports its
    // result before displaying its result screen.
    .replace(/function\s+saveResult\s*\(\s*testId\s*,\s*data\s*\)\s*\{/, "function saveResult(testId,data){ if (!(typeof fullMockActive !== 'undefined' && fullMockActive)) window.parent.postMessage({ source: 'achievers-mock', type: 'submitted', score: Number(data.marks || 0), total: Number(data.total || 0), correct: Number(data.correct || 0), wrong: Number(data.wrong || 0), answers: data.answers || {}, timeTakenSeconds: Number(data.timeUsedSec || 0) }, '*');")
    .replace("function startExam(testId,minutes){", "function startExam(testId,minutes){ window.parent.postMessage({ source: 'achievers-mock', type: 'started' }, '*');")
    .replace("function retryExam() {", "function retryExam() { if (window.__achieversAnalysis) return;")
    .replace("</body>", `<script>window.__achieversRestorePayload=${restorePayload};</script>${bridge}</body>`);
}

export default function MockViewPage({ params }: { params: Promise<{ mockId: string }> }) {
  const router = useRouter();
  const [mockId, setMockId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mock, setMock] = useState<Mock | null>(null);
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<"loading" | "auth" | "error">("loading");
  const [message, setMessage] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const attemptRef = useRef<SavedAttempt | null>(null);
  const startWriteRef = useRef<Promise<void> | null>(null);
  const mockRef = useRef<Mock | null>(null);

  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  useEffect(() => { mockRef.current = mock; }, [mock]);

  useEffect(() => { params.then((value) => setMockId(value.mockId)); }, [params]);
  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthLoading(false); }), []);

  useEffect(() => {
    if (!mockId || !user) return;
    (async () => {
      try {
        // Force-refresh the Firebase ID token so Firestore security rules
        // always see a valid auth claim. Without this, a stale or not-yet-
        // propagated token can cause `signedIn()` to fail server-side even
        // when the client believes the user is logged in — producing the
        // false "permission denied" error on initial page load.
        await user.getIdToken(/* forceRefresh */ true);

        const mockSnapshot = await getDoc(doc(db, "mocks", mockId));
        if (!mockSnapshot.exists() || mockSnapshot.data().status !== "published") throw new Error("This mock is not available.");
        const nextMock = { id: mockSnapshot.id, ...mockSnapshot.data() } as Mock;
        const attemptSnapshot = await getDoc(doc(db, "attempts", `${user.uid}_${mockId}`));
        const chunks = await getDocs(query(collection(db, "mock_file_chunks"), where("mockId", "==", mockId)));
        if (chunks.empty) throw new Error("This mock file is not available.");
        const source = chunks.docs.map((item) => item.data() as { index: number; content: string }).sort((a, b) => a.index - b.index).map((item) => item.content).join("");
        let savedAttempt = attemptSnapshot.exists() ? attemptSnapshot.data() as SavedAttempt : null;
        // An in-progress attempt belongs to a previous visit which ended
        // without submission. A mock is single-attempt, so close it as a
        // zero-score submission before showing the iframe again.
        if (savedAttempt?.status === "in_progress") {
          const total = Number(nextMock.questions || 0);
          const percentile = estimatePercentile(0, total, nextMock.difficulty, nextMock.type);
          savedAttempt = { status: "submitted", score: 0, total, correct: 0, wrong: 0, percentile, answers: {}, timeTakenSeconds: 0 };
          await Promise.all([
            setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { userId: user.uid, mockId, type: nextMock.type, section: nextMock.section || null, ...savedAttempt, submittedAt: serverTimestamp() }, { merge: true }),
            setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "Student", mockId, score: 0, correct: 0, wrong: 0, updatedAt: serverTimestamp() }, { merge: true }),
          ]);
        }
        // Older full-mock records can predate the percentile field. Their
        // completed score remains authoritative, so backfill only the missing
        // derived value while loading the analysis.
        if (savedAttempt?.status === "submitted" && typeof savedAttempt.percentile !== "number") {
          const percentile = estimatePercentile(Number(savedAttempt.score || 0), Number(savedAttempt.total || nextMock.questions || 0), nextMock.difficulty, nextMock.type);
          savedAttempt = { ...savedAttempt, percentile };
          await setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { percentile }, { merge: true });
        }
        setMock(nextMock); attemptRef.current = savedAttempt; setAttempt(savedAttempt); setHtml(addAchieversBridge(source, savedAttempt)); setStatus("loading");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        const code = (error as any)?.code ?? "";
        // On a permission-denied error, automatically retry once after
        // a short delay. This handles the edge case where the auth token
        // was valid but Firestore's evaluation lagged behind the refresh.
        const isPermissions =
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("insufficient") ||
          code === "permission-denied";
        if (isPermissions) {
          // Wait 1.5 s then retry with a fresh token before giving up.
          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
          try {
            await user.getIdToken(true);
            const retrySnap = await getDoc(doc(db, "mocks", mockId));
            if (!retrySnap.exists() || retrySnap.data().status !== "published") throw new Error("This mock is not available.");
            const retryMock = { id: retrySnap.id, ...retrySnap.data() } as Mock;
            const retryAttempt = await getDoc(doc(db, "attempts", `${user.uid}_${mockId}`));
            const retryChunks = await getDocs(query(collection(db, "mock_file_chunks"), where("mockId", "==", mockId)));
            if (retryChunks.empty) throw new Error("This mock file is not available.");
            const retrySource = retryChunks.docs.map((i) => i.data() as { index: number; content: string }).sort((a, b) => a.index - b.index).map((i) => i.content).join("");
            let retrySaved = retryAttempt.exists() ? retryAttempt.data() as SavedAttempt : null;
            if (retrySaved?.status === "in_progress") {
              const total = Number(retryMock.questions || 0);
              const percentile = estimatePercentile(0, total, retryMock.difficulty, retryMock.type);
              retrySaved = { status: "submitted", score: 0, total, correct: 0, wrong: 0, percentile, answers: {}, timeTakenSeconds: 0 };
              await Promise.all([
                setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { userId: user.uid, mockId, type: retryMock.type, section: retryMock.section || null, ...retrySaved, submittedAt: serverTimestamp() }, { merge: true }),
                setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "Student", mockId, score: 0, correct: 0, wrong: 0, updatedAt: serverTimestamp() }, { merge: true }),
              ]);
            }
            if (retrySaved?.status === "submitted" && typeof retrySaved.percentile !== "number") {
              const percentile = estimatePercentile(Number(retrySaved.score || 0), Number(retrySaved.total || retryMock.questions || 0), retryMock.difficulty, retryMock.type);
              retrySaved = { ...retrySaved, percentile };
              await setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { percentile }, { merge: true });
            }
            setMock(retryMock); attemptRef.current = retrySaved; setAttempt(retrySaved); setHtml(addAchieversBridge(retrySource, retrySaved)); setStatus("loading");
            return;
          } catch {
            // Retry also failed — fall through to the user-facing error.
          }
          setMessage("You don't have access to this mock. Please sign out and sign back in, then try again.");
        } else {
          setMessage(msg || "Could not open this mock.");
        }
        setStatus("error");
      }
    })();
  }, [mockId, user]);


  useEffect(() => {
    const onMessage = async (event: MessageEvent<ResultMessage>) => {
      const data = event.data;
      if (data?.source !== "achievers-mock") return;
      // srcDoc runs in a sandboxed (opaque-origin) iframe. Some browsers do
      // not preserve WindowProxy identity consistently for it, so comparing
      // event.source with iframe.contentWindow can discard the result event.
      // The bridge's explicit source tag is the stable contract here.
      if (!user || !mock || !mockId) return;
      if (data.type === "ready") {
        restoreAnalysis();
        return;
      }
      if (data.type === "back-to-list") {
        router.push(`/sectional?section=${mock.section || "VARC"}`);
        return;
      }
      // Full mocks submit each section internally before their final combined
      // result. Never persist or rank one of those partial section scores.
      // The bridge emits the aggregated score with fullMock: true only after
      // all sections have been completed.
      if (data.type === "submitted" && mock.type === "full" && data.fullMock !== true) {
        return;
      }
      const attemptDocument = doc(db, "attempts", `${user.uid}_${mockId}`);
      try {
        if (data.type === "started" && !attemptRef.current) {
          const started: SavedAttempt = { status: "in_progress" };
          // Mark locally before the network request so closing immediately after
          // starting still queues the zero-score finalisation below.
          attemptRef.current = started;
          setAttempt(started);
          startWriteRef.current = setDoc(attemptDocument, { userId: user.uid, mockId, type: mock.type, section: mock.section || null, status: "in_progress", startedAt: serverTimestamp() });
          await startWriteRef.current;
          void logActivity(user, "mock", mock.type === "full" ? `Full Mock · ${mock.name}` : `${mock.section || "Sectional"} Mock · ${mock.name}`);
        }
        const submittedTotal = Number(data.total || mock.questions || 0);
        const isRepairingLegacyFullAttempt =
          mock.type === "full"
          && data.fullMock === true
          && attemptRef.current?.status === "submitted"
          && attemptRef.current.fullMock !== true;
        // Older sectional result pages could send a number from an interim
        // render. When analysis is reopened the bridge recalculates from the
        // saved answers and marks this as a narrowly scoped repair.
        const isRepairingExistingSectionalAttempt =
          mock.type === "sectional"
          && data.repair === true
          && attemptRef.current?.status === "submitted";
        if (data.type === "submitted" && (
          (attemptRef.current?.status !== "submitted" && attemptRef.current?.status !== "submitting")
          || isRepairingLegacyFullAttempt
          || isRepairingExistingSectionalAttempt
        )) {
          let startedWithSubmission = false;
          if (!attemptRef.current) {
            const started: SavedAttempt = { status: "in_progress" };
            attemptRef.current = started;
            setAttempt(started);
            startWriteRef.current = setDoc(attemptDocument, { userId: user.uid, mockId, type: mock.type, section: mock.section || null, status: "in_progress", startedAt: serverTimestamp() });
            startedWithSubmission = true;
          }
          // The uploaded mock switches to its result screen synchronously.
          // Mark the local attempt as no longer in-progress *before* awaiting
          // ranking/database work, so closing that result screen neither asks
          // for confirmation nor overwrites the real score with a zero.
          const submitting: SavedAttempt = { ...attemptRef.current, status: "submitting" };
          attemptRef.current = submitting;
          setAttempt(submitting);
          if (startWriteRef.current) await startWriteRef.current;
          if (startedWithSubmission) void logActivity(user, "mock", mock.type === "full" ? `Full Mock · ${mock.name}` : `${mock.section || "Sectional"} Mock · ${mock.name}`);
          const score = Number(data.score || 0), correct = Number(data.correct || 0), wrong = Number(data.wrong || 0), total = submittedTotal;
          const timeTakenSeconds = isRepairingExistingSectionalAttempt
            ? Number(attemptRef.current?.timeTakenSeconds || 0)
            : typeof data.timeTakenSeconds === "number" ? Math.max(0, data.timeTakenSeconds) : Math.max(0, mock.durationMins * 60 - Number(data.secondsLeft || 0));
          // Persist the completed score before calculating ranks. The live
          // sectional list listens to this document, so it updates as soon as
          // the result is available instead of waiting on every rank record.
          const provisionalPercentile = estimatePercentile(score, total, mock.difficulty, mock.type);
          const reportedAnswers = data.answers && Object.keys(data.answers).length > 0
            ? data.answers
            : attemptRef.current?.answers || {};
          const savedScore: SavedAttempt = {
            status: "submitted", score, total, correct, wrong,
            percentile: provisionalPercentile, answers: reportedAnswers,
            timeTakenSeconds,
            fullMock: data.fullMock === true || attemptRef.current?.fullMock === true,
            // Version 2 counts incorrect TITA responses as wrong responses
            // (zero marks, never +3) in every supported mock template.
            scoringVersion: 2,
          };
          // The uploaded test has already switched to its result screen. Show
          // the student's score immediately; Firestore/ranking writes can
          // finish afterwards without making the result look blank or stale.
          attemptRef.current = savedScore;
          setAttempt(savedScore);
          const attemptUpdate = isRepairingExistingSectionalAttempt
            ? { score, total, correct, wrong, percentile: provisionalPercentile, answers: reportedAnswers, timeTakenSeconds, scoringVersion: 2 }
            : { userId: user.uid, mockId, type: mock.type, section: mock.section || null, ...savedScore, submittedAt: serverTimestamp() };
          await setDoc(attemptDocument, attemptUpdate, { merge: true });

          const rankingSnapshot = await getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mockId)));
          const rankings = rankingSnapshot.docs.map((item) => item.data() as RankingAttempt).filter((item) => item.userId !== user.uid);
          rankings.push({ userId: user.uid, score, correct, wrong });
          const percentile = calculatePercentiles(rankings, total, mock.difficulty, mock.type).get(user.uid) || 0;
          await Promise.all([
            setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "Student", mockId, score, correct, wrong, fullMock: mock.type === "full", updatedAt: serverTimestamp() }),
            setDoc(attemptDocument, { percentile }, { merge: true }),
          ]);
          const submitted: SavedAttempt = { ...savedScore, percentile };
          attemptRef.current = submitted;
          setAttempt(submitted);
          frameRef.current?.contentWindow?.postMessage({ source: "achievers-platform", type: "percentile", percentile }, "*");
        }
      } catch (error) {
        // If saving failed, return to the protected in-progress state. This
        // avoids silently treating an unsaved result as a completed mock.
        if (attemptRef.current?.status === "submitting") {
          const inProgress: SavedAttempt = { ...attemptRef.current, status: "in_progress" };
          attemptRef.current = inProgress;
          setAttempt(inProgress);
        }
        setMessage(error instanceof Error ? error.message : "Could not save this attempt.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [attempt, mock, mockId, router, user]);

  useEffect(() => {
    if (!user || !mockId) return;
    const recordAbandonedAttempt = () => {
      const currentAttempt = attemptRef.current;
      const currentMock = mockRef.current;
      if (currentAttempt?.status !== "in_progress" || !currentMock) return;
      const total = Number(currentMock.questions || 0);
      const percentile = estimatePercentile(0, total, currentMock.difficulty, currentMock.type);
      // Change the local state first so a simultaneous unload cannot let a
      // late submission overwrite this final zero-score attempt.
      const abandoned: SavedAttempt = { status: "submitted", score: 0, total, correct: 0, wrong: 0, percentile, answers: {}, timeTakenSeconds: 0 };
      attemptRef.current = abandoned;
      setAttempt(abandoned);
      void Promise.all([
        // setDoc + merge also succeeds if the initial "started" write has
        // not reached Firestore before the tab is closed.
        setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { userId: user.uid, mockId, type: currentMock.type, section: currentMock.section || null, ...abandoned, submittedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "Student", mockId, score: 0, correct: 0, wrong: 0, updatedAt: serverTimestamp() }, { merge: true }),
      ]);
    };
    window.addEventListener("pagehide", recordAbandonedAttempt);
    return () => window.removeEventListener("pagehide", recordAbandonedAttempt);
  }, [mockId, user]);

  useEffect(() => {
    const confirmExit = (event: BeforeUnloadEvent) => {
      if (attemptRef.current?.status !== "in_progress") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmExit);
    return () => window.removeEventListener("beforeunload", confirmExit);
  }, []);

  function restoreAnalysis() {
    const savedAttempt = attemptRef.current;
    const currentMock = mockRef.current;
    const percentile = savedAttempt?.status === "submitted"
      ? typeof savedAttempt.percentile === "number"
        ? savedAttempt.percentile
        : currentMock
          ? estimatePercentile(Number(savedAttempt.score || 0), Number(savedAttempt.total || currentMock.questions || 0), currentMock.difficulty, currentMock.type)
          : undefined
      : undefined;
    if (savedAttempt?.status === "submitted") frameRef.current?.contentWindow?.postMessage({ source: "achievers-platform", type: "restore", answers: savedAttempt.answers || {}, score: savedAttempt.score, percentile, timeTakenSeconds: savedAttempt.timeTakenSeconds, fullMock: savedAttempt.fullMock === true }, "*");
  }

  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-brand" /> Restoring your session…</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Sign in to open this mock</h1><Link href={`/login?returnTo=${encodeURIComponent(`/mock-view/${mockId || ""}`)}`} className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Continue with Google</Link></div>;
  if (status === "error") return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Could not open mock</h1>
      <p className="mt-2 text-sm text-danger">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {(message.toLowerCase().includes("sign in") || message.toLowerCase().includes("access")) && (
          <Link
            href={`/login?returnTo=${encodeURIComponent(`/mock-view/${mockId || ""}`)}`}
            className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Sign in and retry
          </Link>
        )}
        <Link
          href="/mocks"
          className="inline-flex rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-tint"
        >
          Back to Mocks
        </Link>
      </div>
    </div>
  );
  if (!html) return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-brand" /> Opening your mock…</div>;
  const percentile = attempt?.status === "submitted" && (mock?.type !== "full" || Number(attempt.total || 0) >= Number(mock?.questions || 0))
    ? (typeof attempt.percentile === "number" && attempt.percentile > 0
        ? attempt.percentile
        : estimatePercentile(Number(attempt.score || 0), Number(attempt.total || mock?.questions || 0), mock?.difficulty, mock?.type))
    : null;
  const isInProgress = attempt?.status === "in_progress";
  return <MockViewShell
    mock={mock}
    user={user}
    frameRef={frameRef}
    html={html}
    percentile={percentile}
    score={attempt?.score}
    isInProgress={isInProgress}
    restoreAnalysis={restoreAnalysis}
  />;
}

/* ── Separate shell component keeps the JSX readable ────────────────── */
function MockViewShell({
  mock, user, frameRef, html, percentile, score, isInProgress, restoreAnalysis,
}: {
  mock: { name?: string; type?: string } | null;
  user: User;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  html: string;
  percentile: number | null;
  score?: number;
  isInProgress: boolean;
  restoreAnalysis: () => void;
}) {
  const [exitModalOpen, setExitModalOpen] = useState(false);

  function handleExitClick() {
    if (isInProgress) { setExitModalOpen(true); return; }
    window.close();
  }

  function confirmExit() {
    // Allow the pagehide handler in the parent to record 0 marks.
    window.close();
    // Fallback in case window.close() is blocked (some browsers).
    window.location.href = "/mocks";
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
            : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-darker"><UserRound size={16} /></span>}
          <span>{user.displayName || "Student"}</span>
        </div>
        {isInProgress && (
          <button
            onClick={handleExitClick}
            className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-100 transition"
          >
            <LogOut size={13} /> Exit Mock
          </button>
        )}
      </div>

      {/* Iframe */}
      <iframe
        ref={frameRef}
        srcDoc={html}
        onLoad={restoreAnalysis}
        sandbox="allow-scripts allow-forms"
        title={mock?.name || "Mock"}
        className="min-h-[calc(100vh-49px)] w-full border-0"
      />

      {/* Exit-warning modal */}
      {exitModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </span>
              <div>
                <p className="font-display text-[16px] font-bold text-foreground">Exit this mock?</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                  If you close or leave now, your attempt will be marked as{" "}
                  <span className="font-bold text-red-600">0 marks</span> and you will{" "}
                  <span className="font-semibold text-foreground">not be able to retake</span> this mock.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => setExitModalOpen(false)}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-dark transition"
              >
                Continue Exam
              </button>
              <button
                onClick={confirmExit}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] font-semibold text-red-600 hover:bg-red-100 transition"
              >
                Exit Anyway (0 marks)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
