"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, Loader2, RotateCcw, XCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";

type Difficulty = "Easy" | "Moderate" | "Hard" | "Difficult";
type Section = "Quant" | "VARC" | "DILR";
type StoredQuestion = { id: string; section: "Quant" | "VARC" | "DILR" | "VARC-VA"; chapter: string; difficulty: Difficulty; question: string; options: string[]; correctOption: string; explanation?: string };
type Question = Omit<StoredQuestion, "section"> & { section: Section; context?: string; contextTitle?: string };
type GroupQuestion = Omit<StoredQuestion, "id" | "section" | "chapter" | "difficulty">;
type Group = { id: string; section: "VARC-RC" | "DILR"; chapter: string; title: string; content: string; difficulty: Difficulty; questions: GroupQuestion[] };

const difficultyStyles: Record<Difficulty, string> = { Easy: "bg-brand-tint text-brand-darker", Moderate: "bg-amber-50 text-amber-700", Hard: "bg-red-50 text-red-600", Difficult: "bg-red-50 text-red-600" };

export default function PracticePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("Quant");
  const [chapter, setChapter] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); }), []);
  useEffect(() => {
    if (!authReady) return;
    if (!user) { setLoading(false); return; }
    Promise.all([getDocs(query(collection(db, "practice_questions"), where("published", "==", true))), getDocs(query(collection(db, "practice_groups"), where("published", "==", true)))])
      .then(([questionSnapshot, groupSnapshot]) => {
        const standalone = questionSnapshot.docs.map((item) => {
          const data = { id: item.id, ...item.data() } as StoredQuestion;
          return { ...data, section: data.section === "VARC-VA" ? "VARC" : data.section } as Question;
        });
        const grouped = groupSnapshot.docs.flatMap((item) => {
          const group = { id: item.id, ...item.data() } as Group;
          return group.questions.map((question, questionIndex) => ({ ...question, id: `${group.id}_${questionIndex}`, section: group.section === "VARC-RC" ? "VARC" : "DILR", chapter: group.chapter, difficulty: group.difficulty, context: group.content, contextTitle: group.title } as Question));
        });
        setQuestions([...standalone, ...grouped]);
      }).catch(console.error).finally(() => setLoading(false));
  }, [authReady, user]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "practice_attempts"), where("userId", "==", user.uid)))
      .then((snapshot) => setAnswers(Object.fromEntries(snapshot.docs.map((item) => [String(item.data().questionId), String(item.data().selectedOption)]))))
      .catch((error) => { console.error(error); setSaveError("Your earlier practice progress could not be loaded."); });
  }, [user]);

  const chapters = useMemo(() => [...new Set(questions.filter((item) => item.section === section).map((item) => item.chapter))].sort(), [questions, section]);
  useEffect(() => { setChapter(chapters[0] || ""); setIndex(0); }, [section, chapters]);
  const active = useMemo(() => questions.filter((item) => item.section === section && item.chapter === chapter), [questions, section, chapter]);
  const current = active[index];
  const answered = active.filter((item) => answers[item.id]).length;
  const correct = active.filter((item) => answers[item.id] === item.correctOption).length;

  useEffect(() => {
    if (!active.length) return;
    const nextUnsolved = active.findIndex((item) => !answers[item.id]);
    setIndex(nextUnsolved === -1 ? 0 : nextUnsolved);
  }, [chapter, active, answers]);

  async function saveAnswer(question: Question, selectedOption: string) {
    if (!user || savingAnswer) return;
    const previousAnswer = answers[question.id];
    setAnswers((value) => ({ ...value, [question.id]: selectedOption }));
    setSavingAnswer(true);
    setSaveError("");
    try {
      await setDoc(doc(db, "practice_attempts", `${user.uid}_${question.id}`), { userId: user.uid, questionId: question.id, section: question.section, chapter: question.chapter, selectedOption, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      setAnswers((value) => { const next = { ...value }; if (previousAnswer) next[question.id] = previousAnswer; else delete next[question.id]; return next; });
      setSaveError("Could not save this answer. Please try again.");
    } finally { setSavingAnswer(false); }
  }

  async function resetQuestion(question: Question) {
    if (!user || savingAnswer) return;
    const previousAnswer = answers[question.id];
    setAnswers((value) => { const next = { ...value }; delete next[question.id]; return next; });
    setSavingAnswer(true);
    setSaveError("");
    try { await deleteDoc(doc(db, "practice_attempts", `${user.uid}_${question.id}`)); }
    catch (error) { console.error(error); setAnswers((value) => ({ ...value, [question.id]: previousAnswer })); setSaveError("Could not reset this question. Please try again."); }
    finally { setSavingAnswer(false); }
  }

  if (!authReady || loading) return <Loading />;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><BookOpenCheck className="mx-auto text-brand" size={32} /><h1 className="mt-4 font-display text-2xl font-bold">Sign in to practise chapter-wise</h1><p className="mt-2 text-sm text-muted">Save your momentum with focused CAT practice.</p><Link href="/login?returnTo=%2Fpractice" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Continue with Google</Link></div>;

  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Practice library</p><h1 className="mt-1 font-display text-3xl font-bold">Master one chapter at a time.</h1><p className="mt-2 text-sm text-muted">Choose a CAT area, solve at your pace, and check every explanation instantly.</p>
    <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border border-border bg-white p-4 sm:p-5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">Section<select value={section} onChange={(event) => setSection(event.target.value as Section)} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand"><option>Quant</option><option>VARC</option><option>DILR</option></select></label>
        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">Chapters</p><div className="mt-2 space-y-1">{chapters.map((item) => <button key={item} onClick={() => { setChapter(item); setIndex(0); }} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${chapter === item ? "bg-brand text-white" : "text-muted hover:bg-brand-tint hover:text-brand-darker"}`}>{item}</button>)}{!chapters.length && <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted">No published chapters yet.</p>}</div>
        {active.length > 0 && <div className="mt-6 rounded-xl bg-surface-muted p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted">Your session</p><p className="mt-2 text-lg font-bold text-foreground">{correct}/{active.length} correct</p><p className="text-xs text-muted">{answered} of {active.length} answered</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-brand" style={{ width: `${(answered / active.length) * 100}%` }} /></div></div>}
      </aside>
      <main>{current ? <QuestionCard current={current} index={index} total={active.length} answers={answers} saving={savingAnswer} onAnswer={(answer) => void saveAnswer(current, answer)} onReset={() => void resetQuestion(current)} onPrevious={() => setIndex((value) => value - 1)} onNext={() => setIndex((value) => value + 1)} onSelect={setIndex} active={active} /> : <section className="rounded-2xl border border-dashed border-border bg-white p-12 text-center"><Circle className="mx-auto text-brand" /><h2 className="mt-4 font-display text-xl font-bold">No questions in this chapter yet</h2><p className="mt-2 text-sm text-muted">Your faculty can publish questions from the Admin Practice area.</p></section>}{saveError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{saveError}</p>}</main>
    </div>
  </div>;
}

function Loading() { return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted"><Loader2 className="animate-spin text-brand" /> Loading practice questions…</div>; }

function QuestionCard({ current, index, total, answers, saving, onAnswer, onReset, onPrevious, onNext, onSelect, active }: { current: Question; index: number; total: number; answers: Record<string, string>; saving: boolean; onAnswer: (answer: string) => void; onReset: () => void; onPrevious: () => void; onNext: () => void; onSelect: (index: number) => void; active: Question[] }) {
  const chosen = answers[current.id];
  return <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-brand-darker">Question {index + 1} of {total}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${difficultyStyles[current.difficulty]}`}>{current.difficulty}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-brand transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>{current.context && <div className="mt-6 rounded-xl border border-border bg-surface-muted/60 p-5"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{current.contextTitle || "Passage / set"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{current.context}</p></div>}<h2 className="mt-7 whitespace-pre-wrap font-display text-xl font-bold leading-relaxed text-foreground">{current.question}</h2><div className="mt-6 space-y-3">{current.options.map((option, optionIndex) => { const letter = "ABCDE"[optionIndex]; const result = chosen ? (letter === current.correctOption ? "correct" : letter === chosen ? "wrong" : "") : ""; return <button key={letter} disabled={Boolean(chosen) || saving} onClick={() => onAnswer(letter)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${result === "correct" ? "border-brand bg-brand-tint text-brand-darker" : result === "wrong" ? "border-red-200 bg-red-50 text-danger" : "border-border hover:border-brand hover:bg-brand-tint"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">{letter}</span>{option}{result === "correct" && <CheckCircle2 className="ml-auto" size={18} />}{result === "wrong" && <XCircle className="ml-auto" size={18} />}</button>; })}</div>{chosen && <div className="mt-5 rounded-xl border border-brand/20 bg-brand-tint p-4"><p className="font-bold text-brand-darker">{chosen === current.correctOption ? "Correct — well done." : `Correct answer: ${current.correctOption}`}</p>{current.explanation && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{current.explanation}</p>}<button disabled={saving} onClick={onReset} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 px-3 py-1.5 text-xs font-bold text-brand-darker disabled:opacity-50"><RotateCcw size={14} /> Reset and try again</button></div>}<div className="mt-7 flex items-center justify-between gap-3"><button disabled={index === 0} onClick={onPrevious} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft size={16} /> Previous</button><div className="flex max-w-48 flex-wrap justify-end gap-1.5">{active.map((item, itemIndex) => <button key={item.id} onClick={() => onSelect(itemIndex)} className={`h-8 w-8 rounded-lg text-xs font-bold ${itemIndex === index ? "bg-brand text-white" : answers[item.id] ? "bg-brand-tint text-brand-darker" : "bg-surface-muted text-muted"}`}>{itemIndex + 1}</button>)}</div><button disabled={index === total - 1} onClick={onNext} className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next <ChevronRight size={16} /></button></div></section>;
}
