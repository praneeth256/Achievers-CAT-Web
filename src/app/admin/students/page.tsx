"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Search, Users } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";

type Profile = { id: string; name?: string; displayName?: string; email?: string };
const label = (profile: Profile) => profile.name || profile.displayName || profile.email || "Student";

function StudentDirectory() {
  const [students, setStudents] = useState<Profile[]>([]); const [term, setTerm] = useState("");
  useEffect(() => { getDocs(collection(db, "profiles")).then(snapshot => setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))).catch(console.error); }, []);
  const visible = useMemo(() => students.filter(student => `${label(student)} ${student.email || ""}`.toLowerCase().includes(term.trim().toLowerCase())).sort((a, b) => label(a).localeCompare(label(b))), [students, term]);
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Admin</p><h1 className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold"><Users className="text-brand" /> Student Data</h1><p className="mt-2 text-sm text-muted">Search a student and open their submitted scores, answers and daily-target progress.</p><label className="relative mt-7 block"><Search className="absolute left-3 top-3 text-muted" size={18}/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search by student name or email" className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-brand" /></label><div className="mt-5 divide-y overflow-hidden rounded-2xl border border-border bg-white">{visible.map(student => <Link key={student.id} href={`/admin/students/${student.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-brand-tint"><div className="min-w-0"><p className="truncate font-semibold">{label(student)}</p><p className="truncate text-sm text-muted">{student.email || "No email on profile"}</p></div><span className="shrink-0 text-sm font-semibold text-brand-darker">View progress →</span></Link>)}{!visible.length && <p className="p-8 text-center text-sm text-muted">No students match this search.</p>}</div></div>;
}
export default function AdminStudentsPage() { return <AdminGuard><StudentDirectory /></AdminGuard>; }
