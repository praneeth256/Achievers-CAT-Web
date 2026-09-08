"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, getDocs, query, collection, serverTimestamp, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";
import { calculatePercentiles, estimatePercentile, type RankingAttempt } from "@/lib/mockPercentile";

type Mock = { id: string; name: string; type: "full" | "sectional"; section?: string; questions: number; durationMins: number; difficulty?: string; status: "published" | "draft" };
// "submitting" exists only in the running page.  It prevents an unload from
// turning a completed test into a zero while its Firestore writes finish.
type SavedAttempt = { status: "in_progress" | "submitting" | "submitted"; answers?: Record<string, string>; score?: number; total?: number; correct?: number; wrong?: number; percentile?: number; timeTakenSeconds?: number };
type ResultMessage = { source: "achievers-mock"; type: "ready" | "started" | "submitted" | "back-to-list"; score?: number; total?: number; correct?: number; wrong?: number; answers?: Record<string, string>; secondsLeft?: number; timeTakenSeconds?: number };

function addAchieversBridge(html: string, savedAttempt?: SavedAttempt | null) {
  const restorePayload = savedAttempt?.status === "submitted"
    ? JSON.stringify({ answers: savedAttempt.answers || {}, score: savedAttempt.score || 0, timeTakenSeconds: savedAttempt.timeTakenSeconds || 0 }).replace(/<\//g, "<\\/")
    : "null";
  // Keep the regular-expression escapes intact in the script injected into
  // the uploaded HTML. A normal template literal consumes escapes such as
  // `\\s` and `\\/`, producing invalid JavaScript inside the iframe.
  const bridge = String.raw`<script>
    (function () {
      var sent = false;
      function send(type, extra) { window.parent.postMessage(Object.assign({ source: 'achievers-mock', type: type }, extra || {}), '*'); }
      function reportResult() {
        if (sent || typeof QUESTIONS === 'undefined' || typeof answers === 'undefined') return;
        sent = true;
        var correct = 0, wrong = 0, score = 0;
        QUESTIONS.forEach(function (q, index) {
          var answer = answers[index];
          if (!answer) return;
          var isCorrect = String(answer).trim() === String(q.correct).trim();
          if (isCorrect) { correct++; score += 3; }
          else { wrong++; if (q.q_type === 'MCQ') score -= 1; }
        });
        send('submitted', { score: score, total: QUESTIONS.length, correct: correct, wrong: wrong, answers: answers, secondsLeft: typeof secsLeft === 'number' ? secsLeft : 0 });
      }
      function reportVisibleResult() {
        if (sent) return;
        var candidates = document.querySelectorAll('[data-score], #score, [id*="score" i], [class*="score" i], [id*="result" i], [class*="result" i]');
        for (var index = 0; index < candidates.length; index++) {
          var candidate = candidates[index];
          if (getComputedStyle(candidate).display === 'none' || getComputedStyle(candidate).visibility === 'hidden') continue;
          var text = (candidate.textContent || '').trim();
          var match = text.match(/(?:score|marks?)[^0-9-]*(-?[0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+))?/i) || text.match(/(-?[0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)[\s\S]{0,80}?(?:net marks|score)/i);
          if (!match) continue;
          sent = true;
          send('submitted', { score: Number(match[1]), total: typeof QUESTIONS !== 'undefined' ? QUESTIONS.length : (match[2] ? Math.round(Number(match[2]) / 3) : 0), correct: 0, wrong: 0, answers: typeof answers !== 'undefined' ? answers : {}, secondsLeft: typeof secsLeft === 'number' ? secsLeft : 0 });
          return;
        }
      }
      function reportNewMockResult(savedResult) {
        if (sent || typeof TEST_META === 'undefined' || (!savedResult && typeof loadAllResults !== 'function')) return;
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
        if (sent || typeof TEST_META === 'undefined' || typeof answers === 'undefined') return;
        var testId = typeof currentTestId !== 'undefined' && currentTestId ? currentTestId : (TEST_META[0] && TEST_META[0].id);
        var questions = typeof currentQuestions === 'function' ? currentQuestions() : (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[testId] ? QUESTION_BANK[testId] : []);
        if (!questions || !questions.length) return;
        var correct = 0, wrong = 0, score = 0;
        questions.forEach(function (question, index) {
          var answer = answers[index];
          if (answer === undefined || answer === '') return;
          var isCorrect = String(answer).trim() === String(question.correct).trim();
          if (isCorrect) { correct++; score += 3; }
          else { wrong++; if (question.qType === 'MCQ' || question.q_type === 'MCQ') score -= 1; }
        });
        sent = true;
        send('submitted', {
          score: score, total: questions.length, correct: correct, wrong: wrong, answers: answers,
          timeTakenSeconds: typeof timerStartedAt === 'number' && timerStartedAt ? Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000)) : 0
        });
      }
      function restoreNewMockResult(data) {
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
          marks: typeof data.score === 'number' ? data.score : (correct * 3 - wrongMCQ), correct: correct, wrong: wrong,
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
          if (getComputedStyle(result).display !== 'none') { reportResult(); reportNewMockResult(); reportNewMockState(); reportVisibleResult(); }
        }).observe(result, { attributes: true, attributeFilter: ['style'] });
        new MutationObserver(function () { reportVisibleResult(); }).observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
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
          if (/submit|finish|end test|view result/i.test(label)) setTimeout(function () { reportResult(); reportNewMockResult(); reportNewMockState(); reportVisibleResult(); }, 600);
        }, true);
        // The parent also sends this payload by postMessage, but embedding it
        // makes reopening analysis deterministic even if that message arrives
        // before the uploaded mock has registered its listener.
        if (window.__achieversRestorePayload) {
          setTimeout(function () {
            if (!restoreNewMockResult(window.__achieversRestorePayload) && typeof showResults === 'function') {
              window.__achieversAnalysis = true;
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
        if (data.type === 'restore' && data.answers) {
          window.__achieversAnalysis = true;
          if (restoreNewMockResult(data)) return;
          if (typeof showResults === 'function') {
            answers = data.answers;
            submitted = true;
            if (typeof clearInterval === 'function' && typeof timerInt !== 'undefined') clearInterval(timerInt);
            hideIntroForAnalysis();
            showResults();
          }
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
    .replace(/function\s+saveResult\s*\(\s*testId\s*,\s*data\s*\)\s*\{/, "function saveResult(testId,data){ window.parent.postMessage({ source: 'achievers-mock', type: 'submitted', score: Number(data.marks || 0), total: Number(data.total || 0), correct: Number(data.correct || 0), wrong: Number(data.wrong || 0), answers: data.answers || {}, timeTakenSeconds: Number(data.timeUsedSec || 0) }, '*');")
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
          const percentile = estimatePercentile(0, total, nextMock.difficulty);
          savedAttempt = { status: "submitted", score: 0, total, correct: 0, wrong: 0, percentile, answers: {}, timeTakenSeconds: 0 };
          await Promise.all([
            setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { userId: user.uid, mockId, type: nextMock.type, section: nextMock.section || null, ...savedAttempt, submittedAt: serverTimestamp() }, { merge: true }),
            setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, mockId, score: 0, correct: 0, wrong: 0, updatedAt: serverTimestamp() }, { merge: true }),
          ]);
        }
        setMock(nextMock); attemptRef.current = savedAttempt; setAttempt(savedAttempt); setHtml(addAchieversBridge(source, savedAttempt)); setStatus("loading");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open this mock."); setStatus("error"); }
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
        }
        if (data.type === "submitted" && attemptRef.current?.status !== "submitted" && attemptRef.current?.status !== "submitting") {
          if (!attemptRef.current) {
            const started: SavedAttempt = { status: "in_progress" };
            attemptRef.current = started;
            setAttempt(started);
            startWriteRef.current = setDoc(attemptDocument, { userId: user.uid, mockId, type: mock.type, section: mock.section || null, status: "in_progress", startedAt: serverTimestamp() });
          }
          // The uploaded mock switches to its result screen synchronously.
          // Mark the local attempt as no longer in-progress *before* awaiting
          // ranking/database work, so closing that result screen neither asks
          // for confirmation nor overwrites the real score with a zero.
          const submitting: SavedAttempt = { ...attemptRef.current, status: "submitting" };
          attemptRef.current = submitting;
          setAttempt(submitting);
          if (startWriteRef.current) await startWriteRef.current;
          const score = Number(data.score || 0), correct = Number(data.correct || 0), wrong = Number(data.wrong || 0), total = Number(data.total || mock.questions || 0);
          const timeTakenSeconds = typeof data.timeTakenSeconds === "number" ? Math.max(0, data.timeTakenSeconds) : Math.max(0, mock.durationMins * 60 - Number(data.secondsLeft || 0));
          // Persist the completed score before calculating ranks. The live
          // sectional list listens to this document, so it updates as soon as
          // the result is available instead of waiting on every rank record.
          const provisionalPercentile = estimatePercentile(score, total, mock.difficulty);
          const savedScore: SavedAttempt = { status: "submitted", score, total, correct, wrong, percentile: provisionalPercentile, answers: data.answers || {}, timeTakenSeconds };
          await setDoc(attemptDocument, { userId: user.uid, mockId, type: mock.type, section: mock.section || null, ...savedScore, submittedAt: serverTimestamp() }, { merge: true });
          attemptRef.current = savedScore;
          setAttempt(savedScore);

          const rankingSnapshot = await getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mockId)));
          const rankings = rankingSnapshot.docs.map((item) => item.data() as RankingAttempt).filter((item) => item.userId !== user.uid);
          rankings.push({ userId: user.uid, score, correct, wrong });
          const percentile = calculatePercentiles(rankings, total, mock.difficulty).get(user.uid) || 0;
          await Promise.all([
            setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, mockId, score, correct, wrong, updatedAt: serverTimestamp() }),
            setDoc(attemptDocument, { percentile }, { merge: true }),
          ]);
          const submitted: SavedAttempt = { ...savedScore, percentile };
          attemptRef.current = submitted;
          setAttempt(submitted);
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
      const percentile = estimatePercentile(0, total, currentMock.difficulty);
      // Change the local state first so a simultaneous unload cannot let a
      // late submission overwrite this final zero-score attempt.
      const abandoned: SavedAttempt = { status: "submitted", score: 0, total, correct: 0, wrong: 0, percentile, answers: {}, timeTakenSeconds: 0 };
      attemptRef.current = abandoned;
      setAttempt(abandoned);
      void Promise.all([
        // setDoc + merge also succeeds if the initial "started" write has
        // not reached Firestore before the tab is closed.
        setDoc(doc(db, "attempts", `${user.uid}_${mockId}`), { userId: user.uid, mockId, type: currentMock.type, section: currentMock.section || null, ...abandoned, submittedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "mock_rankings", `${user.uid}_${mockId}`), { userId: user.uid, mockId, score: 0, correct: 0, wrong: 0, updatedAt: serverTimestamp() }, { merge: true }),
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
    if (savedAttempt?.status === "submitted") frameRef.current?.contentWindow?.postMessage({ source: "achievers-platform", type: "restore", answers: savedAttempt.answers || {}, score: savedAttempt.score, timeTakenSeconds: savedAttempt.timeTakenSeconds }, "*");
  }

  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-brand" /> Restoring your session…</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Sign in to open this mock</h1><Link href={`/login?returnTo=${encodeURIComponent(`/mock-view/${mockId || ""}`)}`} className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Continue with Google</Link></div>;
  if (status === "error") return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Could not open mock</h1><p className="mt-2 text-sm text-danger">{message}</p></div>;
  if (!html) return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-brand" /> Opening your mock…</div>;
  const percentile = attempt?.status === "submitted" ? (typeof attempt.percentile === "number" && attempt.percentile > 0 ? attempt.percentile : estimatePercentile(Number(attempt.score || 0), Number(attempt.total || mock?.questions || 0), mock?.difficulty)) : null;
  return <div className="min-h-screen bg-surface-muted"><div className="flex items-center justify-end border-b border-border bg-white px-4 py-2"><div className="flex items-center gap-2 text-sm font-medium text-foreground">{percentile !== null && <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand-darker">Score {attempt?.score} · {percentile.toFixed(2)} %ile</span>}{user.photoURL ? <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-darker"><UserRound size={16} /></span>}<span>{user.displayName || "Student"}</span></div></div><iframe ref={frameRef} srcDoc={html} onLoad={restoreAnalysis} sandbox="allow-scripts allow-forms" title={mock?.name || "Mock"} className="min-h-[calc(100vh-49px)] w-full border-0" /></div>;
}
