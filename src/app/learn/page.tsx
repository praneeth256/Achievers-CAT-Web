"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Layers } from "lucide-react";

const SUBJECTS = [
  {
    key: "dilr",
    label: "DILR",
    desc: "Data Interpretation & Logical Reasoning",
    href: "/learn/dilr",
    count: "412 sets · 28 chapters",
    available: true,
  },
  {
    key: "quant",
    label: "Quant",
    desc: "Quantitative Aptitude",
    href: "/learn/quant",
    count: "Coming soon",
    available: false,
  },
  {
    key: "varc",
    label: "VARC",
    desc: "Verbal Ability & Reading Comprehension",
    href: "/learn/varc",
    count: "Coming soon",
    available: false,
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mb-10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          Chapter-wise video learning
        </p>
        <h1 className="mt-1 font-display text-[28px] font-black text-foreground">
          Learn
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          Choose a subject to start learning from curated chapter-wise video playlists.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SUBJECTS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={`glass-card group p-6 transition-all duration-200 ${
              s.available
                ? "hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/[0.08]"
                : "opacity-60 cursor-default pointer-events-none"
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-tint to-brand/10 text-brand-dark">
              <BookOpen size={20} />
            </div>
            <p className="mt-4 font-display text-[18px] font-bold text-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-[13px] text-muted">{s.desc}</p>
            <p className="mt-3 text-[11.5px] font-semibold text-brand-dark">
              {s.count}
            </p>
            {s.available && (
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-dark opacity-0 transition group-hover:opacity-100">
                Browse playlists <ArrowRight size={12} />
              </span>
            )}
            {!s.available && (
              <span className="mt-3 inline-flex items-center rounded-full bg-brand-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-darker">
                Coming Soon
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
