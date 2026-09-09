"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { BookOpenCheck, ChevronLeft, ChevronRight, Circle, Loader2, RotateCcw } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";
import { logActivity } from "@/lib/firebase/activity";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Difficult";
type Section = "Quant" | "VARC" | "DILR";
type Question = { id: string; section: Section; chapter: string; difficulty: Difficulty; question: string; options: string[]; correctOption: string; questionType?: "MCQ" | "TITA"; correctAnswer?: string; explanation?: string; context?: string; contextTitle?: string; groupId?: string; position?: number };
const styles: Record<Difficulty, string> = { Easy: "bg-brand-tint text-brand-darker", Moderate: "bg-amber-50 text-amber-700", Hard: "bg-red-50 text-red-600", Difficult: "bg-red-50 text-red-600" };
const matches = (q: Question, answer?: string) => q.questionType === "TITA" ? String(q.correctAnswer || "").trim().toLowerCase() === String(answer || "").trim().toLowerCase() : answer === q.correctOption;

export default function PracticePage({ library = "practice" }: { library?: "practice" | "pyq" }) {
  const isPyq = library === "pyq";
  const questionTable = isPyq ? "pyq_questions" : "practice_questions";
  const groupTable = isPyq ? "pyq_groups" : "practice_groups";
  const attemptTable = isPyq ? "pyq_attempts" : "practice_attempts";
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [section, setSection] = useState<Section>("Quant");
  const [chapter, setChapter] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activityLogged = useRef(false);

  useEffect(() => {
    setUser(auth.currentUser); setReady(true);
    return onAuthStateChanged(auth, (session) => { setUser(session); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setLoading(false); return; }
    void (async () => {
      try {
        const [questionSnapshots, groupSnapshots, attemptSnapshots] = await Promise.all([
          getDocs(query(collection(db, questionTable), where("published", "==", true))),
          getDocs(query(collection(db, groupTable), where("published", "==", true))),
          getDocs(query(collection(db, attemptTable), where("userId", "==", user.uid))),
        ]);
        const rows = questionSnapshots.docs.map((item) => ({ id: item.id, ...item.data() }));
        const groups = groupSnapshots.docs.map((item) => ({ id: item.id, ...item.data() }));
        const attempts = attemptSnapshots.docs.map((item) => item.data());
        const standalone = rows.map((row: any) => ({ id: row.id, section: row.section === "VARC-VA" ? "VARC" : row.section, chapter: row.chapter, difficulty: row.difficulty, question: row.question, options: row.options, correctOption: row.correctOption, questionType: row.questionType, correctAnswer: row.correctAnswer, explanation: row.explanation, position: row.position } as Question));
        const grouped = groups.flatMap((group: any) => (group.questions ?? []).map((q: any, i: number) => ({ ...q, id: `${group.id}_${i}`, groupId: group.id, section: group.section === "VARC-RC" ? "VARC" : "DILR", chapter: group.chapter, difficulty: group.difficulty, context: group.content, contextTitle: group.title } as Question)));
        setQuestions([...standalone, ...grouped]);
        setAnswers(Object.fromEntries(attempts.map((attempt: any) => [attempt.questionId, attempt.selectedOption])));
      } catch (cause) {
        console.error(cause);
        setError(`Could not load ${isPyq ? "PYQ" : "practice"} questions.`);
      } finally { setLoading(false); }
    })();
  }, [ready, user, questionTable, groupTable, attemptTable, isPyq]);

  const chapters = useMemo(() => [...new Set(questions.filter((q) => q.section === section).map((q) => q.chapter))].sort(), [questions, section]);
  useEffect(() => { setChapter(chapters[0] || ""); setIndex(0); }, [section, chapters]);
  const visible = useMemo(() => questions.filter((q) => q.section === section && q.chapter === chapter).sort((a, b) => Number(a.position || 0) - Number(b.position || 0) || a.id.localeCompare(b.id)), [questions, section, chapter]);
  const current = visible[index];
  const answered = visible.filter((q) => answers[q.id]).length;
  const correct = visible.filter((q) => matches(q, answers[q.id])).length;

  async function saveAnswer(value: string) {
    if (!user || !current || saving) return;
    const previous = answers[current.id];
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }));
    setSaving(true);
    try {
      await setDoc(doc(db, attemptTable, `${user.uid}_${current.id}`), { userId: user.uid, questionId: current.id, section: current.section, chapter: current.chapter, selectedOption: value }, { merge: true });
      // Record at most one feed row for this practice visit, rather than one
      // write per question answer.
      if (!activityLogged.current) {
        activityLogged.current = true;
        void logActivity(user, isPyq ? "pyq" : "practice", `${current.section} · ${current.chapter}`);
      }
    }
    catch {
      setAnswers((currentAnswers) => { const next = { ...currentAnswers }; if (previous) next[current.id] = previous; else delete next[current.id]; return next; });
      setError("Could not save this answer.");
    }
    setSaving(false);
  }

  async function reset() {
    if (!user || !current || saving) return;
    const previous = answers[current.id];
    setAnswers((currentAnswers) => { const next = { ...currentAnswers }; delete next[current.id]; return next; });
    setSaving(true);
    try { await deleteDoc(doc(db, attemptTable, `${user.uid}_${current.id}`)); } catch { setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: previous })); setError("Could not reset this question."); }
    setSaving(false);
  }

  if (!ready || loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted"><Loader2 className="animate-spin text-brand"/>Loading practice questions...</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><BookOpenCheck className="mx-auto text-brand" size={32}/><h1 className="mt-4 font-display text-2xl font-bold">Sign in to practise chapter-wise</h1><Link href={`/login?returnTo=${encodeURIComponent(isPyq ? "/practice/pyqs" : "/practice")}`} className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Continue with Google</Link></div>;
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{isPyq ? "PYQ library" : "Practice library"}</p><h1 className="mt-1 font-display text-3xl font-bold">Master one chapter at a time.</h1><div className="mt-7 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_150px]"><aside className="rounded-2xl border border-border bg-white p-4"><label className="text-xs font-bold uppercase tracking-wide text-muted">Section<select value={section} onChange={(event) => setSection(event.target.value as Section)} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold"><option>Quant</option><option>VARC</option><option>DILR</option></select></label><p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">Chapters</p><div className="mt-2 space-y-1">{chapters.map((item) => <button key={item} onClick={() => { setChapter(item); setIndex(0); }} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${chapter === item ? "bg-brand text-white" : "text-muted hover:bg-brand-tint"}`}>{item}</button>)}</div><div className="mt-6 rounded-xl bg-surface-muted p-3 text-sm"><b>{correct}/{visible.length} correct</b><p className="text-xs text-muted">{answered} attempted</p></div></aside><main>{current ? <QuestionCard q={current} index={index} total={visible.length} answer={answers[current.id]} saving={saving} onAnswer={saveAnswer} onReset={reset} onPrevious={() => setIndex((value) => value - 1)} onNext={() => setIndex((value) => value + 1)} /> : <div className="rounded-2xl border border-dashed border-border p-12 text-center"><Circle className="mx-auto text-brand"/>No questions in this chapter yet.</div>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-danger">{error}</p>}</main><aside className="lg:sticky lg:top-20 lg:self-start"><div className="rounded-2xl border border-border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Questions</p><div className="mt-3 grid grid-cols-3 gap-2">{visible.map((q, itemIndex) => <button key={q.id} onClick={() => setIndex(itemIndex)} className={`h-9 rounded-lg text-sm font-bold ${index === itemIndex ? "bg-brand text-white" : answers[q.id] ? "bg-brand-tint text-brand-darker" : "bg-surface-muted text-muted"}`}>{itemIndex + 1}</button>)}</div></div></aside></div></div>;
}

function QuestionCard({ q, index, total, answer, saving, onAnswer, onReset, onPrevious, onNext }: { q: Question; index: number; total: number; answer?: string; saving: boolean; onAnswer: (value: string) => void; onReset: () => void; onPrevious: () => void; onNext: () => void }) {
  const [entry, setEntry] = useState("");
  const correct = matches(q, answer);
  return <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-7"><div className="flex justify-between"><p className="font-bold text-brand-darker">Question {index + 1} of {total}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[q.difficulty]}`}>{q.difficulty}</span></div>{q.context && <div className="mt-6 rounded-xl border border-border bg-surface-muted/60 p-5"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{q.contextTitle}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{q.context}</p></div>}<h2 className="mt-7 whitespace-pre-wrap font-display text-xl font-bold leading-relaxed">{q.question}</h2>{q.questionType === "TITA" ? <div className="mt-6 flex gap-3"><input value={answer || entry} disabled={Boolean(answer) || saving} onChange={(event) => setEntry(event.target.value)} placeholder="Enter your answer" className="min-w-0 flex-1 rounded-xl border border-border px-4 py-3 text-sm"/><button disabled={Boolean(answer) || saving || !entry.trim()} onClick={() => onAnswer(entry)} className="rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Submit</button></div> : <div className="mt-6 space-y-3">{q.options.map((option, optionIndex) => { const label = "ABCDE"[optionIndex]; const state = answer ? (label === q.correctOption ? "border-brand bg-brand-tint" : label === answer ? "border-red-200 bg-red-50 text-danger" : "border-border") : "border-border hover:border-brand"; return <button key={label} disabled={Boolean(answer) || saving} onClick={() => onAnswer(label)} className={`flex w-full gap-3 rounded-xl border px-4 py-3 text-left text-sm ${state}`}><span className="font-bold">{label}.</span>{option}</button>; })}</div>}{answer && <div className="mt-5 rounded-xl bg-brand-tint p-4 text-sm"><b>{correct ? "Correct - well done." : `Correct answer: ${q.questionType === "TITA" ? q.correctAnswer : q.correctOption}`}</b>{q.explanation && <p className="mt-2 whitespace-pre-wrap">{q.explanation}</p>}<button disabled={saving} onClick={onReset} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-darker"><RotateCcw size={14}/>Reset and try again</button></div>}<div className="mt-7 flex justify-between"><button disabled={index === 0} onClick={onPrevious} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft size={16}/>Previous</button><button disabled={index === total - 1} onClick={onNext} className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next<ChevronRight size={16}/></button></div></section>;
}
