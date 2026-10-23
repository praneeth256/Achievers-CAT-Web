"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import { ArrowLeft, FileUp, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import { showToast } from "@/components/Toast";

type Mock = {
  id: string;
  name: string;
  type: "full" | "sectional";
  section?: string;
  questions: number;
  durationMins: number;
  difficulty: string;
  status: "published" | "draft";
  fileName: string;
  fileSize: number;
  chunkCount: number;
};

const emptyForm = {
  name: "",
  type: "full" as "full" | "sectional",
  section: "VARC",
  questions: 66,
  durationMins: 120,
  difficulty: "CAT Level",
  status: "published" as "published" | "draft",
};

export default function AdminMocksPage() {
  return <AdminGuard><MockManager /></AdminGuard>;
}

function MockManager() {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"full" | "sectional">("full");

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "mocks"), orderBy("createdAt", "desc")));
      const mockNum = (name: string) => { const m = name.match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; };
      const sorted = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mock)).sort((a, b) => mockNum(b.name) - mockNum(a.name));
      setMocks(sorted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load mocks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editingId && !file) {
      setMessage("Please choose the HTML mock file.");
      return;
    }
    if (file && !/\.html?$/i.test(file.name)) {
      setMessage("Please upload an .html or .htm file.");
      return;
    }
    if (file && file.size > 15 * 1024 * 1024) {
      setMessage("This HTML file is larger than 15 MB. Please reduce its size.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      let mockId = editingId;
      if (!mockId) {
        const created = await addDoc(collection(db, "mocks"), {
          name: form.name.trim(),
          type: form.type,
          section: form.type === "sectional" ? form.section : null,
          questions: Number(form.questions),
          durationMins: Number(form.durationMins),
          difficulty: form.difficulty,
          status: form.status,
          fileName: file?.name || "",
          fileSize: file?.size || 0,
          chunkCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        mockId = created.id;
      } else {
        await updateDoc(doc(db, "mocks", mockId), {
          name: form.name.trim(),
          type: form.type,
          section: form.type === "sectional" ? form.section : null,
          questions: Number(form.questions),
          durationMins: Number(form.durationMins),
          difficulty: form.difficulty,
          status: form.status,
          updatedAt: serverTimestamp(),
          ...(file ? { fileName: file.name, fileSize: file.size } : {}),
        });
      }

      if (file && mockId) {
        const oldChunks = await getDocs(query(collection(db, "mock_file_chunks"), where("mockId", "==", mockId)));
        const deleteBatch = writeBatch(db);
        oldChunks.docs.forEach((d) => deleteBatch.delete(d.ref));
        await deleteBatch.commit();

        const text = await file.text();
        const chunkSize = 600_000;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) chunks.push(text.slice(i, i + chunkSize));

        for (let start = 0; start < chunks.length; start += 450) {
          const batch = writeBatch(db);
          chunks.slice(start, start + 450).forEach((content, offset) => {
            const index = start + offset;
            batch.set(doc(db, "mock_file_chunks", `${mockId}_${index}`), {
              mockId,
              index,
              content,
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }

        await updateDoc(doc(db, "mocks", mockId), {
          chunkCount: chunks.length,
          fileName: file.name,
          fileSize: file.size,
          updatedAt: serverTimestamp(),
        });
      }

      setMessage("Mock saved successfully. Students can open it in a new tab.");
      showToast(form.status === "published" ? "Mock published" : "Changes saved");
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save mock.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setFile(null);
    setEditingId(null);
  }

  function edit(mock: Mock) {
    setEditingId(mock.id);
    setForm({
      name: mock.name,
      type: mock.type,
      section: mock.section || "VARC",
      questions: mock.questions,
      durationMins: mock.durationMins,
      difficulty: mock.difficulty,
      status: mock.status,
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(mock: Mock) {
    if (!window.confirm(`Delete "${mock.name}"? This will remove the uploaded HTML file.`)) return;
    try {
      const chunks = await getDocs(query(collection(db, "mock_file_chunks"), where("mockId", "==", mock.id)));
      for (let start = 0; start < chunks.docs.length; start += 450) {
        const batch = writeBatch(db);
        chunks.docs.slice(start, start + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, "mocks", mock.id));
      setMessage("Mock deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete mock.");
    }
  }

  const visible = mocks.filter((m) => m.type === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker"><ArrowLeft size={14} /> Admin</Link>
          <h1 className="mt-2 font-display text-[28px] font-bold">Mock Manager</h1>
          <p className="mt-1 text-[14px] text-muted">Upload the HTML file you already use. Students will open it in a separate tab.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[17px] font-semibold">{editingId ? "Edit Mock" : "Add Mock"}</h2>
          {editingId && <button onClick={resetForm} className="text-sm font-semibold text-muted hover:text-foreground">Cancel edit</button>}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="text-[12px] font-semibold text-muted">Mock name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ACHIEVERS CAT Full Mock #01" className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </label>
          <label>
            <span className="text-[12px] font-semibold text-muted">Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "full" | "sectional" })} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
              <option value="full">Full Mock</option>
              <option value="sectional">Sectional Mock</option>
            </select>
          </label>
          {form.type === "sectional" && (
            <label>
              <span className="text-[12px] font-semibold text-muted">Section</span>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                <option>VARC</option><option>DILR</option><option>QA</option>
              </select>
            </label>
          )}
          <label>
            <span className="text-[12px] font-semibold text-muted">Questions</span>
            <input type="number" value={form.questions} onChange={(e) => setForm({ ...form, questions: Number(e.target.value) })} className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm" />
          </label>
          <label>
            <span className="text-[12px] font-semibold text-muted">Duration (minutes)</span>
            <input type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })} className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm" />
          </label>
          <label>
            <span className="text-[12px] font-semibold text-muted">Difficulty</span>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
              <option>Easy</option><option>Moderate</option><option>Hard</option><option>CAT Level</option>
            </select>
          </label>
          <label>
            <span className="text-[12px] font-semibold text-muted">Status</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "published" | "draft" })} className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
              <option value="published">Published</option><option value="draft">Draft</option>
            </select>
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-brand/40 bg-brand-tint-2 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-dark"><FileUp size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{file ? file.name : editingId ? "Choose a new HTML file (optional)" : "Choose your HTML mock file"}</span>
            <span className="mt-1 block text-[12px] text-muted">.html / .htm · up to 15 MB · stored in Firestore in chunks</span>
          </span>
          <input type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <button onClick={save} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          {saving ? "Uploading…" : editingId ? "Update Mock" : "Upload & Publish"}
        </button>
        {message && <p className={`mt-3 text-sm ${message.includes("successfully") || message === "Mock deleted." ? "text-brand-darker" : "text-danger"}`}>{message}</p>}
      </div>

      <div className="mt-8 flex gap-2 rounded-full border border-border bg-surface-muted p-1">
        <button onClick={() => setFilter("full")} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${filter === "full" ? "bg-white shadow-sm" : "text-muted"}`}>Full Mocks ({mocks.filter((m) => m.type === "full").length})</button>
        <button onClick={() => setFilter("sectional")} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${filter === "sectional" ? "bg-white shadow-sm" : "text-muted"}`}>Sectional Mocks ({mocks.filter((m) => m.type === "sectional").length})</button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? <div className="py-10 text-center text-sm text-muted">Loading mocks…</div> : visible.map((mock) => (
          <div key={mock.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold">{mock.name}</p>
              <p className="mt-1 text-[12.5px] text-muted">{mock.type === "sectional" ? `${mock.section} · ` : ""}{mock.questions} questions · {mock.durationMins} min · {mock.fileName || "No file"}</p>
              <p className="mt-1 text-[12px] font-semibold text-brand-darker">{mock.status === "published" ? "Published" : "Draft"}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {mock.status === "published" && <Link href={`/mock-view/${mock.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] font-semibold hover:border-brand"><ExternalLink size={14} /> Open</Link>}
              <button onClick={() => edit(mock)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] font-semibold hover:border-brand"><Pencil size={14} /> Edit</button>
              <button onClick={() => remove(mock)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3.5 py-2 text-[13px] font-semibold text-danger hover:bg-red-50"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ))}
        {!loading && visible.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No {filter} mocks yet.</div>}
      </div>
    </div>
  );
}
