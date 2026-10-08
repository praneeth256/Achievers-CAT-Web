"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPaste, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type PracticeQuestion = { section: "Quant" | "VARC-VA"; chapter: string; difficulty: "Easy" | "Moderate" | "Hard" | "Difficult"; question: string; questionType?: "MCQ" | "TITA"; options: string[]; correctOption: string; correctAnswer?: string; explanation?: string; published: boolean };
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

export function PracticeManager({ library = "practice" }: { library?: "practice" | "pyq" }) {
  const [form, setForm] = useState<PracticeQuestion>(emptyQuestion());
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isPyq = library === "pyq";
  const questionTable = isPyq ? "pyq_questions" : "practice_questions";
  const groupTable = isPyq ? "pyq_groups" : "practice_groups";
  const update = <K extends keyof PracticeQuestion>(key: K, value: PracticeQuestion[K]) => setForm((current) => ({ ...current, [key]: value }));

  // ── One-click seed: Odd One Out ──────────────────────────────────────────
  const ODD_ONE_OUT_QUESTIONS: Omit<PracticeQuestion, "options" | "correctOption">[] = [
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. A friend can be any one who is there for you, be it a bad friend or a good friend, but out of all your friends there is always the better one, and this the good one.\n2. Your friend is an inveterate globe-trotter, and his letters are full of memories of other trips.\n3. He has a wry and very engaging sense of humour, he's a movie fan, he used to be quite an activist (though he was never much into 'ideology'), and he's thoughtful and very well read.\n4. Imagine getting letters from a friend in Japan, letters full of images, sounds and ideas.\n5. In his letters, he wants to share with you the faces that have caught his eye, the events that made him smile or weep, the places where he's felt at home.\n\nCorrect order: 4-2-3-5", questionType: "TITA", correctAnswer: "1", explanation: "The context is about getting letters from a friend in Japan. Statement (1) says who a friend is in a general sense, so it is the odd one out.\nCorrect order: 4235", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. For once, I can't empathize with Hollywood.\n2. In a post this week entitled \"Time to Panic: Inside the Movie Business' Summer of Hell,\" Variety detailed Hollywood's disastrous summer of 2017.\n3. So…what's on TV?\n4. And truly, the only way this summer could have been more hellacious for the industry is if they'd actually had to sit down and watch one of their own films.\n5. I mean, people: you put The Emoji Movie out into the world—a 90-minute animated star turn for the Meh face—is a lukewarm audience reaction any surprise?\n\nCorrect order: 1-2-4-5", questionType: "TITA", correctAnswer: "3", explanation: "The discussion is about Hollywood/movies, specifically how bad the movies have been. 'What's on TV?' is out of place.\nCorrect order: 1245", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Moreover, it was a dream that revealed to a scientist the molecular structure of carbon atoms in the benzene ring.\n2. Dreams can be baffling and mysterious.\n3. All this mystery can leave us wondering what a particular dream means to the dreamer.\n4. Dreams are always \"true\"—it's just that what they mean isn't always what we think they mean.\n5. Throughout history dreams have been associated with sacred revelation and prophecy.\n\nCorrect order: 2-5-1-3", questionType: "TITA", correctAnswer: "4", explanation: "Statement (4), which talks about dreams being 'true', is out of context with the flow.\nCorrect order: 2513", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. There is no single profile for the successful chief executive.\n2. Great chief executives have a \"nose\" for what are the most significant issues, challenges, threats, and opportunities facing an organization.\n3. Others may benefit from a quieter approach, from a leader who can build relationships without appearing too \"salesy\" and who can avoid spooking relevant markets.\n4. In every case, boards will have a broad set of business conditions to assess before determining their target profile.\n5. Some companies may require a true extrovert — someone willing to trumpet the company's successes through constant and varied social gatherings.\n\nCorrect order: 1-4-5-3", questionType: "TITA", correctAnswer: "2", explanation: "Statement (2) discusses one specific quality of chief executives and breaks the unity.\nCorrect order: 1453", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. The turbaned Mr. Punch of Calcutta smokes a hubble-bubble while being entertained by maidens.\n2. Of all the English comic magazines of the period, 'The Indian Charivari' was the most accomplished.\n3. It appeared in 1872 with an Indian version of Richard Doyle's famous Punch cover.\n4. Caricature as a form of journalism was imported from Britain by the British in India which was initially on Anglo-Indian lifestyle, eventually turned to Indian.\n5. Although the magazine excelled in caricatures of Indians, it also resorts to share mild jokes about English social life and other topical issues.\n\nCorrect order: 2-3-5-1", questionType: "TITA", correctAnswer: "4", explanation: "Statement (4) discusses caricature as a form of journalism and is the odd one out.\nCorrect order: 2351", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. If Swapo has historically shown little interest in highlighting the colonial-era genocide, Namibia's tiny but economically powerful German-speaking minority has shown strong resistance.\n2. Six years ago, the most prominent statue of the German colonial era was toppled from a hill overlooking Windhoek, the capital.\n3. Namibia's complicated internal dynamics have contributed as well.\n4. The Herero and Nama are minorities in a nation led since independence by the liberation party, the South West Africa People's Organization, or Swapo, which is dominated by the Ovambo ethnic group.\n5. German reticence is not the only reason the reckoning has taken so long.\n\nCorrect order: 5-3-4-1", questionType: "TITA", correctAnswer: "2", explanation: "Statement (2) is completely out of context.\nCorrect order: 5341", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Practice makes perfect.\n2. A common chef's manoeuvre: cut around the long side of the fruit down to the seed with a large knife.\n3. Cooking is a science and a chef needs to be precise.\n4. Then firmly tap the knife blade on the centre of the seed a few times until it sticks.\n5. Twist the top half off like a jar lid.\n\nCorrect order: 2-5-4-1", questionType: "TITA", correctAnswer: "3", explanation: "Statement (3) is a general statement about a chef and is therefore the odd one out.\nCorrect order: 2541", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Originally, it only referred to coastal travel between ports, but the definition has expanded to include travel by air, railway, and by road.\n2. Let's make one thing clear: Cabotage does not mean to sabotage a taxi driver, which we do not recommend in any circumstance, just as a general tip for safe driving.\n3. So, what's the real definition?\n4. Believe it or not, this is an outdated term for \"armpit.\"\n5. It means the transport of goods and passengers between two places in the same country, or the right to do so.\n\nCorrect order: 2-3-5-1", questionType: "TITA", correctAnswer: "4", explanation: "Statement (4), which discusses 'armpit', is the odd one out.\nCorrect order: 2351", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. In 1976, the KGB tried a different tactic, forging FBI documents suggesting that hardline anti-Communist Sen. Scoop Jackson was gay, then sending them off to different newspapers in a bid to derail his campaign.\n2. In 1960 and 1968, Soviet spies reached out to Democratic candidates to offer assistance in the form of friendly propaganda or secret funding.\n3. The notion of Russia attempting to influence American elections isn't particularly new.\n4. Both of the candidates in question, Adlai Stevenson and Hubert Humphrey, turned down their offer (and went on to lose their campaigns).\n5. The Russian bid to influence the 2016 combined outreach to a potentially friendly campaign and spreading fake news with the theft of Clinton's private emails.\n\nCorrect order: 3-2-4-1", questionType: "TITA", correctAnswer: "5", explanation: "Statement (5) is out of context with the historical examples being discussed.\nCorrect order: 3241", published: true },
    { section: "VARC-VA", chapter: "Odd One Out", difficulty: "Moderate", question: "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. It's thanks to Greenpeace supporters that we can keep putting in the hours to uncover and publish the facts.\n2. Climate change is the story of the century.\n3. As journalists, we have a responsibility to tell it right.\n4. But that takes time, resources and expertise – and we're up against a constant tide of fake news and misinformation.\n5. Greenpeace India is an independent organisation registered in India, connected to a network of other Greenpeace offices in over 55 countries.\n\nCorrect order: 2-3-4-1", questionType: "TITA", correctAnswer: "5", explanation: "Statement (5) explains what Greenpeace India is, which breaks the unity of the paragraph.\nCorrect order: 2341\n\nDevelopment: 2 (X is important) → 3 (Y has responsibility for X) → 4 (challenges in executing that responsibility) → 1 (Z is helping in that regard)", published: true },
  ];

  async function seedOddOneOut() {
    try {
      setSaving(true);
      const now = Date.now();
      await Promise.all(
        ODD_ONE_OUT_QUESTIONS.map((q, i) =>
          addDoc(collection(db, questionTable), {
            section: q.section,
            chapter: q.chapter,
            difficulty: q.difficulty,
            question: q.question,
            questionType: "TITA",
            options: [],
            correctOption: "",
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            published: true,
            position: now + i * 1000,
          })
        )
      );
      setMessage(`✅ Seeded ${ODD_ONE_OUT_QUESTIONS.length} "Odd One Out" TITA questions under VARC → Odd One Out.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not seed questions.");
    } finally {
      setSaving(false);
    }
  }

  function validate(value: PracticeQuestion) {
    if (!value.chapter.trim() || !value.question.trim()) throw new Error("Add a chapter and question.");
    if (value.questionType === "TITA") { if (!value.correctAnswer?.trim()) throw new Error("Add the correct TITA answer."); return; }
    if (value.options.length < 4 || value.options.length > 5 || value.options.some((option) => !option.trim())) throw new Error("Add four or five non-empty MCQ options.");
    if (!/^[ABCDE]$/.test(value.correctOption) || value.options.length < "ABCDE".indexOf(value.correctOption) + 1) throw new Error("Correct option must match one of the supplied options (A to E).");
  }
  function validateGroup(value: PracticeGroup) {
    if (!value.chapter.trim() || !value.title.trim() || !value.content.trim()) throw new Error("Add a chapter, title, and shared passage or set content.");
    if (value.section === "VARC-RC" && !value.questions.length) throw new Error("An RC passage needs at least one linked question.");
    if (value.section === "DILR" && value.questions.length !== 4) throw new Error("A DILR set needs exactly four linked questions.");
    value.questions.forEach((question) => validate({ ...question, section: "Quant", chapter: value.chapter, difficulty: value.difficulty, published: value.published }));
  }
  async function saveManual() {
    try { validate(form); setSaving(true); await addDoc(collection(db, questionTable), { section: form.section, chapter: form.chapter.trim(), difficulty: form.difficulty, question: form.question.trim(), questionType: form.questionType || "MCQ", options: form.questionType === "TITA" ? [] : form.options.map((option) => option.trim()), correctOption: form.correctOption, correctAnswer: form.correctAnswer || null, explanation: form.explanation?.trim() || "", published: form.published, position: Date.now() }); setForm(emptyQuestion()); setMessage(`${isPyq ? "PYQ" : "Practice"} question published for students.`); }
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
      const questionRows = rows.map((item, index) => ({ section: item.section, chapter: item.chapter.trim(), difficulty: item.difficulty, question: item.question.trim(), questionType: item.questionType || "MCQ", options: item.questionType === "TITA" ? [] : (item.options || []).map((option) => option.trim()), correctOption: item.correctOption, correctAnswer: item.correctAnswer || null, explanation: item.explanation?.trim() || "", published: item.published !== false, position: Date.now() + index }));
      const groupRows = groups.map((item) => ({ section: item.section, chapter: item.chapter.trim(), title: item.title.trim(), content: item.content.trim(), difficulty: item.difficulty, questions: item.questions, published: item.published !== false }));
      if (questionRows.length) await Promise.all(questionRows.map((row) => addDoc(collection(db, questionTable), row)));
      if (groupRows.length) await Promise.all(groupRows.map((row) => addDoc(collection(db, groupTable), row)));
      setBulk(""); setMessage(`${rows.length} standalone questions and ${groups.length} grouped RC/DILR sets published.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import questions."); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Admin</p><h1 className="mt-1 font-display text-3xl font-bold">{isPyq ? "Topic-wise PYQs" : "Chapter-wise Practice"}</h1><p className="mt-2 text-sm text-muted">Add questions individually or publish a complete chapter in one JSON paste. Each import appends new questions and never replaces earlier questions.</p>
    {!isPyq && <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-tint/60 p-4 flex flex-wrap items-center gap-4"><div><p className="text-[13px] font-bold text-brand-darker">⚡ One-click seed: Odd One Out (10 questions)</p><p className="text-[12px] text-muted mt-0.5">Adds 10 VARC TITA "Odd One Out" questions under <strong>VARC → Odd One Out</strong>. Run once — clicking again will add duplicates.</p></div><button onClick={() => void seedOddOneOut()} disabled={saving} className="shrink-0 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} Seed Odd One Out</button></div>}
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Plus className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Quant or VA question</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Select label="Section" value={form.section} onChange={(value) => update("section", value as PracticeQuestion["section"])} values={["Quant", "VARC-VA"]}/><Field label="Chapter" value={form.chapter} onChange={(value) => update("chapter", value)}/><Select label="Difficulty" value={form.difficulty} onChange={(value) => update("difficulty", value as PracticeQuestion["difficulty"])} values={["Easy", "Moderate", "Hard"]}/></div><Area label="Question" value={form.question} onChange={(value) => update("question", value)}/><div className="mt-4 grid gap-3 sm:grid-cols-2">{form.options.map((option, index) => <Field key={index} label={`Option ${"ABCD"[index]}`} value={option} onChange={(value) => update("options", form.options.map((item, itemIndex) => itemIndex === index ? value : item))}/>)}</div><div className="mt-4 flex flex-wrap items-end gap-4"><Select label="Correct option" value={form.correctOption} onChange={(value) => update("correctOption", value)} values={["A", "B", "C", "D"]}/><label className="inline-flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={form.published} onChange={(event) => update("published", event.target.checked)}/> Publish now</label></div><Area label="Explanation" value={form.explanation || ""} onChange={(value) => update("explanation", value)}/><button onClick={saveManual} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>} Save question</button></section>
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><ClipboardPaste className="text-brand" size={18}/><h2 className="font-display text-xl font-bold">Bulk JSON import</h2></div><p className="mt-2 text-sm text-muted">Paste a JSON object with standalone questions and/or shared RC/DILR groups. Each question needs four options and a correct-option letter.</p><pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{sample}</pre><textarea value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="Paste your JSON here" className="mt-4 min-h-52 w-full rounded-xl border border-border p-3 font-mono text-xs outline-none focus:border-brand" spellCheck={false}/><button onClick={importBulk} disabled={saving || !bulk.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <ClipboardPaste size={16}/>} Import & publish</button></section></div>
    <GroupEditor saving={saving} onSave={async (group) => { try { validateGroup(group); setSaving(true); await addDoc(collection(db, groupTable), { section: group.section, chapter: group.chapter.trim(), title: group.title.trim(), content: group.content.trim(), difficulty: group.difficulty, questions: group.questions, published: group.published }); setMessage(`${group.section === "VARC-RC" ? "RC passage" : "DILR set"} published with four linked questions.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save group."); } finally { setSaving(false); } }}/>{message && <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-darker"><CheckCircle2 size={16}/>{message}</p>}</div>;
}
function GroupEditor({ saving, onSave }: { saving: boolean; onSave: (group: PracticeGroup) => Promise<void> }) { const blank = (): GroupQuestion => ({ question: "", options: ["", "", "", ""], correctOption: "A", explanation: "" }); const [group, setGroup] = useState<PracticeGroup>({ section: "VARC-RC", chapter: "Reading Comprehension", title: "", content: "", difficulty: "Moderate", questions: Array.from({ length: 4 }, blank), published: true }); const changeQuestion = (index: number, patch: Partial<GroupQuestion>) => setGroup((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) })); return <section className="mt-6 rounded-2xl border border-border bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold">RC passage or DILR set</h2><p className="mt-1 text-sm text-muted">The shared passage/set is saved once and exactly four questions are linked to it.</p><div className="mt-5 grid gap-4 sm:grid-cols-4"><Select label="Type" value={group.section} values={["VARC-RC", "DILR"]} onChange={(value) => setGroup({ ...group, section: value as PracticeGroup["section"] })}/><Field label="Chapter" value={group.chapter} onChange={(value) => setGroup({ ...group, chapter: value })}/><Field label="Title" value={group.title} onChange={(value) => setGroup({ ...group, title: value })}/><Select label="Difficulty" value={group.difficulty} values={["Easy", "Moderate", "Hard"]} onChange={(value) => setGroup({ ...group, difficulty: value as PracticeGroup["difficulty"] })}/></div><Area label={group.section === "VARC-RC" ? "RC passage" : "DILR set / data"} value={group.content} onChange={(value) => setGroup({ ...group, content: value })}/><div className="mt-5 grid gap-4 lg:grid-cols-2">{group.questions.map((question, index) => <div key={index} className="rounded-xl border border-border p-4"><p className="font-bold text-brand-darker">Question {index + 1}</p><Area label="Question" value={question.question} onChange={(value) => changeQuestion(index, { question: value })}/><div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <Field key={optionIndex} label={`Option ${"ABCD"[optionIndex]}`} value={option} onChange={(value) => changeQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? value : item) })}/>)}</div><div className="mt-3"><Select label="Correct" value={question.correctOption} values={["A", "B", "C", "D"]} onChange={(value) => changeQuestion(index, { correctOption: value })}/></div><Area label="Explanation" value={question.explanation || ""} onChange={(value) => changeQuestion(index, { explanation: value })}/></div>)}</div><button onClick={() => void onSave(group)} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Upload size={16}/> Save linked set</button></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="mt-4 block text-sm font-semibold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-border p-3 text-sm font-normal outline-none focus:border-brand"/></label>; }
function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand">{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }
export default function AdminPracticePage() { return <AdminGuard><PracticeManager /></AdminGuard>; }
