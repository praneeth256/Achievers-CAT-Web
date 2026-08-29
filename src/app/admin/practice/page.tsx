"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { CheckCircle2, ClipboardPaste, Loader2, Plus, Upload } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";

type PracticeQuestion = { section: "Quant" | "VARC-VA"; chapter: string; difficulty: "Easy" | "Moderate" | "Hard" | "Difficult"; question: string; options: string[]; correctOption: string; explanation?: string; published: boolean };
type GroupQuestion = Pick<PracticeQuestion, "question" | "options" | "correctOption" | "explanation">;
type PracticeGroup = { section: "VARC-RC" | "DILR"; chapter: string; title: string; content: string; difficulty: "Easy" | "Moderate" | "Hard" | "Difficult"; questions: GroupQuestion[]; published: boolean };
const emptyQuestion = (): PracticeQuestion => ({ section: "Quant", chapter: "Arithmetic", difficulty: "Moderate", question: "", options: ["", "", "", ""], correctOption: "A", explanation: "", published: true });
const sample = `{
  "questions": [{
    "section": "Quant",
    "chapter": "Arithmetic",
    "difficulty": "Moderate",
    "question": "A number is increased by 20% and then decreased by 20%. What is the net change?",
    "options": ["No change", "4% decrease", "4% increase", "8% decrease"],
    "correctOption": "B",
    "explanation": "1.20 × 0.80 = 0.96, so the value decreases by 4%.",
    "published": true
  }, {
    "section": "VARC-VA",
    "chapter": "Para Summary",
    "difficulty": "Easy",
    "question": "Which option best captures the paragraph's central idea?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": "A",
    "explanation": "Replace this with the reasoning.",
    "published": true
  }],
  "groups": [{
    "section": "VARC-RC",
    "chapter": "Reading Comprehension",
    "title": "Lichens and their ecosystems",
    "content": "Paste the full RC passage here.",
    "difficulty": "Moderate",
    "questions": [{ "question": "What is the main idea?", "options": ["A", "B", "C", "D"], "correctOption": "A", "explanation": "Explanation here." }, { "question": "Question 2", "options": ["A", "B", "C", "D"], "correctOption": "B" }, { "question": "Question 3", "options": ["A", "B", "C", "D"], "correctOption": "C" }, { "question": "Question 4", "options": ["A", "B", "C", "D"], "correctOption": "D" }],
    "published": true
  }, {
    "section": "DILR",
    "chapter": "Games and Tournaments",
    "title": "Four teams and their points table",
    "content": "Paste the full DILR set, table details, and conditions here.",
    "difficulty": "Hard",
    "questions": [{ "question": "Question 1", "options": ["A", "B", "C", "D"], "correctOption": "A" }, { "question": "Question 2", "options": ["A", "B", "C", "D"], "correctOption": "B" }, { "question": "Question 3", "options": ["A", "B", "C", "D"], "correctOption": "C" }, { "question": "Question 4", "options": ["A", "B", "C", "D"], "correctOption": "D" }],
    "published": true
  }]
}`;

function PracticeManager() {
  const [form, setForm] = useState<PracticeQuestion>(emptyQuestion());
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const update = <K extends keyof PracticeQuestion>(key: K, value: PracticeQuestion[K]) => setForm((current) => ({ ...current, [key]: value }));

  function validate(value: PracticeQuestion) {
    if (!value.chapter.trim() || !value.question.trim() || value.options.length < 4 || value.options.length > 5 || value.options.some((option) => !option.trim())) throw new Error("Add a chapter, question, and four or five non-empty options.");
    if (!/^[ABCDE]$/.test(value.correctOption) || value.options.length < "ABCDE".indexOf(value.correctOption) + 1) throw new Error("Correct option must match one of the supplied options (A to E).");
  }
  function validateGroup(value: PracticeGroup) {
    if (!value.chapter.trim() || !value.title.trim() || !value.content.trim()) throw new Error("Add a chapter, title, and shared passage or set content.");
    if (value.section === "VARC-RC" && !value.questions.length) throw new Error("An RC passage needs at least one linked question.");
    if (value.section === "DILR" && value.questions.length !== 4) throw new Error("A DILR set needs exactly four linked questions.");
    value.questions.forEach((question) => validate({ ...question, section: "Quant", chapter: value.chapter, difficulty: value.difficulty, published: value.published }));
  }
  async function saveManual() {
    try { validate(form); setSaving(true); await addDoc(collection(db, "practice_questions"), { ...form, chapter: form.chapter.trim(), question: form.question.trim(), options: form.options.map((option) => option.trim()), explanation: form.explanation?.trim() || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setForm(emptyQuestion()); setMessage("Question published for students."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save question."); }
    finally { setSaving(false); }
  }
  async function importBulk() {
    try {
      const parsed = JSON.parse(bulk) as PracticeQuestion[] | { questions?: PracticeQuestion[]; groups?: PracticeGroup[] };
      const rows = Array.isArray(parsed) ? parsed : parsed.questions || [];
      const groups = Array.isArray(parsed) ? [] : parsed.groups || [];
      if (!rows.length && !groups.length) throw new Error("Add a questions or groups array to your JSON.");
      rows.forEach(validate);
      groups.forEach(validateGroup);
      setSaving(true);
      for (let start = 0; start < rows.length; start += 450) {
        const batch = writeBatch(db);
        rows.slice(start, start + 450).forEach((item) => batch.set(doc(collection(db, "practice_questions")), { ...item, chapter: item.chapter.trim(), question: item.question.trim(), options: item.options.map((option) => option.trim()), explanation: item.explanation?.trim() || "", published: item.published !== false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      for (let start = 0; start < groups.length; start += 450) {
        const batch = writeBatch(db);
        groups.slice(start, start + 450).forEach((item) => batch.set(doc(collection(db, "practice_groups")), { ...item, published: item.published !== false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      setBulk(""); setMessage(`${rows.length} standalone questions and ${groups.length} grouped RC/DILR sets published.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import questions."); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Admin</p><h1 className="mt-1 font-display text-3xl font-bold">Chapter-wise Practice</h1><p className="mt-2 text-sm text-muted">Add questions individually or publish a complete chapter in one JSON paste. Published questions are immediately visible to signed-in students.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Plus className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Quant or VA question</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Select label="Section" value={form.section} onChange={(value) => update("section", value as PracticeQuestion["section"])} values={["Quant", "VARC-VA"]}/><Field label="Chapter" value={form.chapter} onChange={(value) => update("chapter", value)}/><Select label="Difficulty" value={form.difficulty} onChange={(value) => update("difficulty", value as PracticeQuestion["difficulty"])} values={["Easy", "Moderate", "Hard"]}/></div><Area label="Question" value={form.question} onChange={(value) => update("question", value)}/><div className="mt-4 grid gap-3 sm:grid-cols-2">{form.options.map((option, index) => <Field key={index} label={`Option ${"ABCD"[index]}`} value={option} onChange={(value) => update("options", form.options.map((item, itemIndex) => itemIndex === index ? value : item))}/>)}</div><div className="mt-4 flex flex-wrap items-end gap-4"><Select label="Correct option" value={form.correctOption} onChange={(value) => update("correctOption", value)} values={["A", "B", "C", "D"]}/><label className="inline-flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={form.published} onChange={(event) => update("published", event.target.checked)}/> Publish now</label></div><Area label="Explanation" value={form.explanation || ""} onChange={(value) => update("explanation", value)}/><button onClick={saveManual} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>} Save question</button></section>
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><ClipboardPaste className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Bulk JSON import</h2></div><p className="mt-2 text-sm text-muted">Paste a JSON object with standalone questions and/or shared RC/DILR groups. Each question needs four options and a correct-option letter.</p><pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{sample}</pre><textarea value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="Paste your JSON here" className="mt-4 min-h-52 w-full rounded-xl border border-border p-3 font-mono text-xs outline-none focus:border-brand" spellCheck={false}/><button onClick={importBulk} disabled={saving || !bulk.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <ClipboardPaste size={16}/>} Import & publish</button></section></div>
    <GroupEditor saving={saving} onSave={async (group) => { try { validateGroup(group); setSaving(true); await addDoc(collection(db, "practice_groups"), { ...group, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setMessage(`${group.section === "VARC-RC" ? "RC passage" : "DILR set"} published with four linked questions.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save group."); } finally { setSaving(false); } }}/>{message && <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-darker"><CheckCircle2 size={16}/>{message}</p>}</div>;
}
function GroupEditor({ saving, onSave }: { saving: boolean; onSave: (group: PracticeGroup) => Promise<void> }) { const blank = (): GroupQuestion => ({ question: "", options: ["", "", "", ""], correctOption: "A", explanation: "" }); const [group, setGroup] = useState<PracticeGroup>({ section: "VARC-RC", chapter: "Reading Comprehension", title: "", content: "", difficulty: "Moderate", questions: Array.from({ length: 4 }, blank), published: true }); const changeQuestion = (index: number, patch: Partial<GroupQuestion>) => setGroup((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) })); return <section className="mt-6 rounded-2xl border border-border bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold">RC passage or DILR set</h2><p className="mt-1 text-sm text-muted">The shared passage/set is saved once and exactly four questions are linked to it.</p><div className="mt-5 grid gap-4 sm:grid-cols-4"><Select label="Type" value={group.section} values={["VARC-RC", "DILR"]} onChange={(value) => setGroup({ ...group, section: value as PracticeGroup["section"] })}/><Field label="Chapter" value={group.chapter} onChange={(value) => setGroup({ ...group, chapter: value })}/><Field label="Title" value={group.title} onChange={(value) => setGroup({ ...group, title: value })}/><Select label="Difficulty" value={group.difficulty} values={["Easy", "Moderate", "Hard"]} onChange={(value) => setGroup({ ...group, difficulty: value as PracticeGroup["difficulty"] })}/></div><Area label={group.section === "VARC-RC" ? "RC passage" : "DILR set / data"} value={group.content} onChange={(value) => setGroup({ ...group, content: value })}/><div className="mt-5 grid gap-4 lg:grid-cols-2">{group.questions.map((question, index) => <div key={index} className="rounded-xl border border-border p-4"><p className="font-bold text-brand-darker">Question {index + 1}</p><Area label="Question" value={question.question} onChange={(value) => changeQuestion(index, { question: value })}/><div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <Field key={optionIndex} label={`Option ${"ABCD"[optionIndex]}`} value={option} onChange={(value) => changeQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? value : item) })}/>)}</div><div className="mt-3"><Select label="Correct" value={question.correctOption} values={["A", "B", "C", "D"]} onChange={(value) => changeQuestion(index, { correctOption: value })}/></div><Area label="Explanation" value={question.explanation || ""} onChange={(value) => changeQuestion(index, { explanation: value })}/></div>)}</div><button onClick={() => void onSave(group)} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Upload size={16}/> Save linked set</button></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="mt-4 block text-sm font-semibold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-border p-3 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand">{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }
export default function AdminPracticePage() { return <AdminGuard><PracticeManager /></AdminGuard>; }
