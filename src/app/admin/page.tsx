"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import AdminGuard from "@/components/AdminGuard";
import { Users, FileStack, HelpCircle, FolderOpen, ClipboardList } from "lucide-react";
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
  { title: "Daily Reads", desc: "Publish a newspaper PDF or a clickable essay link for signed-in students.", href: "/admin/daily-reads" },
  { title: "Sectional Mocks", desc: "Upload, edit, publish or delete VARC, DILR and QA HTML mocks.", href: "/admin/mocks?type=sectional" },
  { title: "Full Mocks", desc: "Upload, edit, publish or delete your full CAT HTML mocks.", href: "/admin/mocks?type=full" },
  { title: "Materials", desc: "Upload materials by CAT section and topic.", href: "/admin/materials" },
  { title: "Performance / Analytics", desc: "Review activity, test metrics, and ranked student results for every mock.", href: "/admin/analytics" },
  { title: "Notifications", desc: "Send a notification to every signed-in student.", href: "/admin/notifications" },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const sources = [["Students", "profiles"], ["Mocks", "mocks"], ["Questions", "questions"], ["Materials", "materials"], ["Attempts", "attempts"]] as const;
    Promise.all(sources.map(async ([label, source]) => [label, (await getCountFromServer(collection(db, source))).data().count] as const))
      .then((entries) => setCounts(Object.fromEntries(entries)))
      .catch(console.error);
  }, []);
  return (
    <AdminGuard>
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
    </div>
    </AdminGuard>
  );
}
