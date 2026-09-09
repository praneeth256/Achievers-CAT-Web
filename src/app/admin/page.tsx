"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, FileStack, FolderOpen, HelpCircle, Users } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { createClient } from "@/lib/supabase/client";

const sections = [
  { title: "Daily Practice", desc: "Create and publish the QA, RC/VA, and DILR package students see each day.", href: "/admin/daily" },
  { title: "Chapter-wise Practice", desc: "Add standalone Quant/VA questions and RC/DILR sets.", href: "/admin/practice" },
  { title: "Topic-wise PYQs", desc: "Add and publish past-year questions and grouped sets.", href: "/admin/practice/pyqs" },
  { title: "Daily Reads", desc: "Publish a newspaper PDF or a clickable essay link.", href: "/admin/daily-reads" },
  { title: "Sectional Mocks", desc: "Create, publish, and manage sectional mock tests.", href: "/admin/mocks?type=sectional" },
  { title: "Full Mocks", desc: "Create, publish, and manage full CAT mocks.", href: "/admin/mocks?type=full" },
  { title: "Materials", desc: "Publish study materials by CAT section and topic.", href: "/admin/materials" },
  { title: "Performance / Analytics", desc: "Review student attempts and test metrics.", href: "/admin/analytics" },
  { title: "Notifications", desc: "Send messages visible to signed-in students.", href: "/admin/notifications" },
];

export default function AdminDashboard() {
  return <AdminGuard><AdminDashboardContent /></AdminGuard>;
}

function AdminDashboardContent() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const supabase = createClient();
    const tables = [["Students", "profiles"], ["Daily packages", "daily_packages"], ["Practice questions", "practice_questions"], ["PYQs", "pyq_questions"], ["Daily attempts", "daily_attempts"]] as const;
    void Promise.all(tables.map(async ([label, table]) => {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      return [label, count ?? 0] as const;
    })).then((rows) => setCounts(Object.fromEntries(rows)));
  }, []);
  const stats = [
    { label: "Students", icon: Users }, { label: "Daily packages", icon: FileStack }, { label: "Practice questions", icon: HelpCircle }, { label: "PYQs", icon: FolderOpen }, { label: "Daily attempts", icon: ClipboardList },
  ];
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"><h1 className="font-display text-[26px] font-bold text-foreground">Achievers CAT - Admin</h1><p className="mt-2 text-[14px] text-muted">Manage Supabase content, student practice, and daily preparation.</p><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">{stats.map((item) => <div key={item.label} className="rounded-2xl border border-border bg-white p-4"><item.icon size={16} className="text-brand-dark"/><p className="mt-2 font-display text-[19px] font-bold text-foreground">{counts[item.label] ?? "-"}</p><p className="text-[12px] text-muted">{item.label}</p></div>)}</div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-border bg-white p-5 transition hover:border-brand hover:shadow-md hover:shadow-brand/[0.06]"><p className="font-display text-[15px] font-semibold text-foreground">{item.title}</p><p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.desc}</p></Link>)}</div></div>;
}
