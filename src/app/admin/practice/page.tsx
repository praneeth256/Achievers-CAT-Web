"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { CheckCircle2, ClipboardPaste, Loader2, Plus, Upload } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";

type PracticeQuestion = { section: "Quant" | "VARC" | "DILR"; chapter: string; difficulty: "Easy" | "Moderate" | "Hard"; question: string; options: string[]; correctOption: string; explanation?: string; published: boolean };
const emptyQuestion = (): PracticeQuestion => ({ section: "Quant", chapter: "Arithmetic", difficulty: "Moderate", question: "", options: ["", "", "", ""], correctOption: "A", explanation: "", published: true });
const sample = `[
  {
    "section": "Quant",
    "chapter": "Arithmetic",
    "difficulty": "Moderate",
    "question": "A number is increased by 20% and then decreased by 20%. What is the net change?",
    "options": ["No change", "4% decrease", "4% increase", "8% decrease"],
    "correctOption": "B",
    "explanation": "1.20 × 0.80 = 0.96, so the value decreases by 4%.",
    "published": true
  }
]`;

function PracticeManager() {
  const [form, setForm] = useState<PracticeQuestion>(emptyQuestion());
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const update = <K extends keyof PracticeQuestion>(key: K, value: PracticeQuestion[K]) => setForm((current) => ({ ...current, [key]: value }));

  function validate(value: PracticeQuestion) {
    if (!value.chapter.trim() || !value.question.trim() || value.options.some((option) => !option.trim())) throw new Error("Add a chapter, question, and all four options.");
    if (!/^[ABCD]$/.test(value.correctOption)) throw new Error("Correct option must be A, B, C, or D.");
  }
  async function saveManual() {
    try { validate(form); setSaving(true); await addDoc(collection(db, "practice_questions"), { ...form, chapter: form.chapter.trim(), question: form.question.trim(), options: form.options.map((option) => option.trim()), explanation: form.explanation?.trim() || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setForm(emptyQuestion()); setMessage("Question published for students."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save question."); }
    finally { setSaving(false); }
  }
  async function importBulk() {
    try {
      const rows = JSON.parse(bulk) as PracticeQuestion[];
      if (!Array.isArray(rows) || !rows.length) throw new Error("Paste a JSON array with at least one question.");
      rows.forEach(validate);
      setSaving(true);
      for (let start = 0; start < rows.length; start += 450) {
        const batch = writeBatch(db);
        rows.slice(start, start + 450).forEach((item) => batch.set(doc(collection(db, "practice_questions")), { ...item, chapter: item.chapter.trim(), question: item.question.trim(), options: item.options.map((option) => option.trim()), explanation: item.explanation?.trim() || "", published: item.published !== false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      setBulk(""); setMessage(`${rows.length} questions published for students.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import questions."); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Admin</p><h1 className="mt-1 font-display text-3xl font-bold">Chapter-wise Practice</h1><p className="mt-2 text-sm text-muted">Add questions individually or publish a complete chapter in one JSON paste. Published questions are immediately visible to signed-in students.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Plus className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Add one question</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Select label="Section" value={form.section} onChange={(value) => update("section", value as PracticeQuestion["section"])} values={["Quant", "VARC", "DILR"]}/><Field label="Chapter" value={form.chapter} onChange={(value) => update("chapter", value)}/><Select label="Difficulty" value={form.difficulty} onChange={(value) => update("difficulty", value as PracticeQuestion["difficulty"])} values={["Easy", "Moderate", "Hard"]}/></div><Area label="Question" value={form.question} onChange={(value) => update("question", value)}/><div className="mt-4 grid gap-3 sm:grid-cols-2">{form.options.map((option, index) => <Field key={index} label={`Option ${"ABCD"[index]}`} value={option} onChange={(value) => update("options", form.options.map((item, itemIndex) => itemIndex === index ? value : item))}/>)}</div><div className="mt-4 flex flex-wrap items-end gap-4"><Select label="Correct option" value={form.correctOption} onChange={(value) => update("correctOption", value)} values={["A", "B", "C", "D"]}/><label className="inline-flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={form.published} onChange={(event) => update("published", event.target.checked)}/> Publish now</label></div><Area label="Explanation" value={form.explanation || ""} onChange={(value) => update("explanation", value)}/><button onClick={saveManual} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>} Save question</button></section>
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><ClipboardPaste className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Bulk JSON import</h2></div><p className="mt-2 text-sm text-muted">Paste an array of questions. Every item needs four options and the letter of the correct option.</p><pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{sample}</pre><textarea value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="Paste your JSON array here" className="mt-4 min-h-52 w-full rounded-xl border border-border p-3 font-mono text-xs outline-none focus:border-brand" spellCheck={false}/><button onClick={importBulk} disabled={saving || !bulk.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <ClipboardPaste size={16}/>} Import & publish</button></section></div>
    {message && <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-darker"><CheckCircle2 size={16}/>{message}</p>}</div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="mt-4 block text-sm font-semibold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-border p-3 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand">{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }
export default function AdminPracticePage() { return <AdminGuard><PracticeManager /></AdminGuard>; }
