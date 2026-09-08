"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getCountFromServer, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import AdminGuard from "@/components/AdminGuard";
import { Users, FileStack, HelpCircle, FolderOpen, ClipboardList, Activity } from "lucide-react";
import { db } from "@/lib/firebase/client";

const stats = [
  { label: "Students", value: "—", icon: Users },
  { label: "Mocks", value: "—", icon: FileStack },
  { label: "Questions", value: "—", icon: HelpCircle },
  { label: "Materials", value: "—", icon: FolderOpen },
  { label: "Attempts", value: "—", icon: ClipboardList },
];

const sections = [
  { title: "Daily Practice", desc: "Create and edit Question of the Day with text/image questions, options and solutions.", href: "/admin/daily" },
  { title: "Chapter-wise Practice", desc: "Add published Quant, VARC and DILR questions manually or through a JSON bulk import.", href: "/admin/practice" },
  { title: "Topic-wise PYQs", desc: "Upload and publish past-year questions section-wise without replacing earlier uploads.", href: "/admin/practice/pyqs" },
  { title: "Daily Reads", desc: "Publish a newspaper PDF or a clickable essay link for signed-in students.", href: "/admin/daily-reads" },
  { title: "Sectional Mocks", desc: "Upload, edit, publish or delete VARC, DILR and QA HTML mocks.", href: "/admin/mocks?type=sectional" },
  { title: "Full Mocks", desc: "Upload, edit, publish or delete your full CAT HTML mocks.", href: "/admin/mocks?type=full" },
  { title: "Materials", desc: "Upload materials by CAT section and topic.", href: "/admin/materials" },
  { title: "Performance / Analytics", desc: "Review activity, test metrics, and ranked student results for every mock.", href: "/admin/analytics" },
  { title: "Notifications", desc: "Send a notification to every signed-in student.", href: "/admin/notifications" },
];

export default function AdminDashboard() {
  return <AdminGuard><AdminDashboardContent /></AdminGuard>;
}

type UserActivity = {
  id: string;
  userName?: string;
  type?: "signin" | "mock" | "practice" | "pyq" | "daily";
  detail?: string;
  createdAt?: { toDate?: () => Date };
};

function activityMessage(activity: UserActivity) {
  const name = activity.userName || "A student";
  switch (activity.type) {
    case "signin": return `${name} signed in`;
    case "mock": return `${name} attempted ${activity.detail || "a mock"}`;
    case "practice": return `${name} attempted practice: ${activity.detail || "a question"}`;
    case "pyq": return `${name} attempted a topic-wise PYQ: ${activity.detail || "a question"}`;
    case "daily": return `${name} attempted daily target: ${activity.detail || "a section"}`;
    default: return `${name} had new activity`;
  }
}

function activityTime(activity: UserActivity, now: number) {
  const date = activity.createdAt?.toDate?.();
  if (!date) return "Just now";
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function AdminDashboardContent() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sources = [["Students", "profiles"], ["Mocks", "mocks"], ["Questions", "questions"], ["Materials", "materials"], ["Attempts", "attempts"]] as const;
    Promise.all(sources.map(async ([label, source]) => [label, (await getCountFromServer(collection(db, source))).data().count] as const))
      .then((entries) => setCounts(Object.fromEntries(entries)))
      .catch(console.error);
  }, []);
  useEffect(() => onSnapshot(query(collection(db, "user_activities"), orderBy("createdAt", "desc"), limit(40)), (snapshot) => {
    setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as UserActivity));
  }, (error) => console.error("Could not load user activity:", error)), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-[26px] font-bold text-foreground">
        Achievers CAT — Admin
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        This area should sit behind an admin-only route guard checked against
        the <code className="rounded bg-surface-muted px-1.5 py-0.5">role</code>{" "}
        column on the user&apos;s profile.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
            <s.icon size={16} className="text-brand-dark" />
            <p className="mt-2 font-display text-[19px] font-bold text-foreground">
              {counts[s.label] ?? s.value}
            </p>
            <p className="text-[12px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-border bg-white p-5 transition hover:border-brand hover:shadow-md hover:shadow-brand/[0.06]"
          >
            <p className="font-display text-[15px] font-semibold text-foreground">
              {s.title}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {s.desc}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><Activity size={18} className="text-brand" /><div><h2 className="font-display text-lg font-semibold text-foreground">User activity</h2><p className="mt-0.5 text-sm text-muted">Latest student activity, updated live.</p></div></div>
        <div className="mt-5 max-h-96 divide-y divide-border overflow-y-auto pr-2">
          {activities.map((activity) => <div key={activity.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"><p className="min-w-0 text-sm font-medium text-foreground">{activityMessage(activity)}</p><time className="shrink-0 text-xs text-muted" dateTime={activity.createdAt?.toDate?.()?.toISOString()}>{activityTime(activity, now)}</time></div>)}
          {!activities.length && <p className="py-5 text-center text-sm text-muted">No student activity yet. New sign-ins and attempts will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
