"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ClipboardList, FileStack, FolderOpen, HelpCircle, LogIn, Users } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const sections = [
  { title: "Daily Practice", desc: "Create and publish the QA, RC/VA, and DILR package students see each day.", href: "/admin/daily" },
  { title: "Chapter-wise Practice", desc: "Add standalone Quant/VA questions and RC/DILR sets.", href: "/admin/practice" },
  { title: "Topic-wise PYQs", desc: "Add and publish past-year questions and grouped sets.", href: "/admin/practice/pyqs" },
  { title: "Daily Reads", desc: "Publish a newspaper PDF or a clickable essay link.", href: "/admin/daily-reads" },
  { title: "Sectional Mocks", desc: "Create, publish, and manage sectional mock tests.", href: "/admin/mocks?type=sectional" },
  { title: "Full Mocks", desc: "Create, publish, and manage full CAT mocks.", href: "/admin/mocks?type=full" },
  { title: "Materials", desc: "Publish study materials by CAT section and topic.", href: "/admin/materials" },
  { title: "Performance / Analytics", desc: "Review student attempts and test metrics.", href: "/admin/analytics" },
  { title: "Student Data", desc: "Search students and open their submitted tests, answers, scores, and daily-target progress.", href: "/admin/students" },
  { title: "Notifications", desc: "Send messages visible to signed-in students.", href: "/admin/notifications" },
];

type UserActivity = { id: string; userName?: string; type?: string; detail?: string; createdAt?: { toDate?: () => Date } };

const activityCopy: Record<string, string> = {
  signin: "signed in",
  mock: "attempted",
  practice: "attempted practice",
  pyq: "attempted topic-wise PYQs",
  daily: "attempted daily targets",
};

function timeAgo(value?: { toDate?: () => Date }) {
  const date = value?.toDate?.();
  if (!date) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminDashboard() {
  return <AdminGuard><AdminDashboardContent /></AdminGuard>;
}

function AdminDashboardContent() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<UserActivity[]>([]);
  useEffect(() => {
    const tables = [["Students", "profiles"], ["Daily packages", "daily_packages"], ["Practice questions", "practice_questions"], ["PYQs", "pyq_questions"], ["Daily attempts", "daily_attempts"]] as const;
    void Promise.all(tables.map(async ([label, table]) => {
      const snapshot = await getCountFromServer(collection(db, table));
      return [label, snapshot.data().count] as const;
    })).then((rows) => setCounts(Object.fromEntries(rows)));
  }, []);
  useEffect(() => {
    // A capped, one-time query gives admins a useful feed without maintaining
    // a real-time listener (or repeatedly reading the whole activity history).
    getDocs(query(collection(db, "user_activities"), orderBy("createdAt", "desc"), limit(30)))
      .then((snapshot) => setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as UserActivity)))
      .catch((error) => console.error("Could not load user activity:", error));
  }, []);
  const stats = [
    { label: "Students", icon: Users }, { label: "Daily packages", icon: FileStack }, { label: "Practice questions", icon: HelpCircle }, { label: "PYQs", icon: FolderOpen }, { label: "Daily attempts", icon: ClipboardList },
  ];
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"><h1 className="font-display text-[26px] font-bold text-foreground">Achievers CAT - Admin</h1><p className="mt-2 text-[14px] text-muted">Manage Firebase content, student practice, and daily preparation.</p><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">{stats.map((item) => <div key={item.label} className="rounded-2xl border border-border bg-white p-4"><item.icon size={16} className="text-brand-dark"/><p className="mt-2 font-display text-[19px] font-bold text-foreground">{counts[item.label] ?? "-"}</p><p className="text-[12px] text-muted">{item.label}</p></div>)}</div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-border bg-white p-5 transition hover:border-brand hover:shadow-md hover:shadow-brand/[0.06]"><p className="font-display text-[15px] font-semibold text-foreground">{item.title}</p><p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.desc}</p></Link>)}</div><section className="mt-8 rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Activity size={18} className="text-brand-dark"/><div><h2 className="font-display text-lg font-semibold">User activity</h2><p className="text-sm text-muted">Latest 30 events, newest first.</p></div></div><div className="thin-scroll mt-5 max-h-80 divide-y divide-border overflow-y-auto pr-2">{activities.length ? activities.map((activity) => <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0"><span className="mt-0.5 rounded-lg bg-brand-tint p-2 text-brand-darker">{activity.type === "signin" ? <LogIn size={15} /> : <ClipboardList size={15} />}</span><p className="min-w-0 flex-1 text-sm text-foreground"><span className="font-semibold">{activity.userName || "Student"}</span> {activityCopy[activity.type || ""] || "was active"}{activity.detail ? <span className="text-muted"> · {activity.detail}</span> : null}</p><time className="shrink-0 text-xs text-muted" title={activity.createdAt?.toDate?.().toLocaleString()}>{timeAgo(activity.createdAt)}</time></div>) : <p className="py-5 text-sm text-muted">No user activity yet.</p>}</div></section></div>;
}
