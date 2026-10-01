"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

const SUBJECTS = [
  {
    key: "quant",
    label: "Quantitative Aptitude",
    desc: "Arithmetic · Algebra · Number System · Geometry",
    href: "/learn/quant",
    count: "215 videos · 44 chapters · 4 modules",
    available: true,
    icon: "🔢",
    color: "from-blue-400/20 to-blue-500/10",
    tag: "Rodha · 2IIM · Handakafunda",
  },
  {
    key: "dilr",
    label: "DILR",
    desc: "Data Interpretation & Logical Reasoning",
    href: "/learn/dilr",
    count: "149 videos · 25 chapters · 412 practice sets",
    available: true,
    icon: "📊",
    color: "from-emerald-400/20 to-emerald-500/10",
    tag: "Aptitude Jab · GOAT CAT PYQs",
  },
  {
    key: "varc",
    label: "VARC",
    desc: "Verbal Ability & Reading Comprehension",
    href: "/learn/varc",
    count: "56 videos · 12 chapters · 4 modules",
    available: true,
    icon: "📖",
    color: "from-purple-400/20 to-purple-500/10",
    tag: "Verbal Ability · RC · Critical Reasoning",
  },
];

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
                <BookOpen size={18} />
              </span>
              <h1 className="font-display text-[24px] font-bold text-foreground">Learn</h1>
            </div>
            <p className="mt-1 text-[13.5px] text-muted ml-12">
              420 curated YouTube videos — sequenced chapter by chapter for CAT 2026.
            </p>
          </div>
          <div className="hidden sm:block text-5xl">📚</div>
        </div>

        {/* Stats bar */}
        <div className="glass-card-green mb-6 p-4 flex flex-wrap gap-5">
          {[
            { label: "Total Videos", value: "420" },
            { label: "Chapters", value: "81" },
            { label: "Sections", value: "3" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-[22px] font-black text-brand-darker">{s.value}</p>
              <p className="text-[12px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Subject cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="edu-card overflow-hidden group block"
            >
              {/* Card gradient top */}
              <div className={`h-24 bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <span className="text-5xl">{s.icon}</span>
              </div>
              {/* Card body */}
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-display text-[17px] font-bold text-foreground">{s.label}</p>
                  <ArrowRight size={16} className="text-muted group-hover:text-brand-darker transition-colors" />
                </div>
                <p className="text-[12.5px] text-muted mb-2">{s.desc}</p>
                <p className="text-[12px] font-semibold text-brand-dark mb-2">{s.count}</p>
                <p className="text-[11px] text-muted/80 truncate">{s.tag}</p>
                <div className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-darker">
                  Browse videos <ArrowRight size={12} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Tip */}
        <div className="mt-8 rounded-2xl border border-brand/15 bg-brand-tint/50 p-4">
          <p className="text-[13px] text-brand-darker font-medium">
            💡 <strong>How it works:</strong> Each chapter lists videos in sequence order — watch them in order for best results. Click any video to open it on YouTube.
          </p>
        </div>
      </div>
    </div>
  );
}
