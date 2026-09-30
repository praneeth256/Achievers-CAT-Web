"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Play } from "lucide-react";

const SUBJECTS = [
  {
    key: "dilr",
    label: "DILR",
    desc: "Data Interpretation & Logical Reasoning",
    href: "/learn/dilr",
    count: "412 sets · 28 chapters",
    available: true,
    icon: "📊",
    color: "from-emerald-400/20 to-emerald-500/10",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "quant",
    label: "Quant",
    desc: "Quantitative Aptitude",
    href: "/learn/quant",
    count: "Coming soon",
    available: false,
    icon: "🔢",
    color: "from-blue-400/20 to-blue-500/10",
    iconBg: "bg-blue-50 text-blue-600",
  },
  {
    key: "varc",
    label: "VARC",
    desc: "Verbal Ability & Reading Comprehension",
    href: "/learn/varc",
    count: "Coming soon",
    available: false,
    icon: "📖",
    color: "from-purple-400/20 to-purple-500/10",
    iconBg: "bg-purple-50 text-purple-600",
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
              Concepts, videos, notes and examples — all in one place.
            </p>
          </div>
          <div className="hidden sm:block text-5xl">📚</div>
        </div>

        {/* Subject cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className={`edu-card overflow-hidden group block ${
                s.available ? "" : "opacity-60 pointer-events-none"
              }`}
            >
              {/* Card gradient top */}
              <div className={`h-24 bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <span className="text-5xl">{s.icon}</span>
              </div>
              {/* Card body */}
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-display text-[18px] font-bold text-foreground">{s.label}</p>
                  {s.available ? (
                    <ArrowRight size={16} className="text-muted group-hover:text-brand-darker transition-colors" />
                  ) : (
                    <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-darker">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-muted mb-3">{s.desc}</p>
                <p className="text-[12px] font-semibold text-brand-dark">{s.count}</p>
                {s.available && (
                  <div className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-darker">
                    <Play size={12} fill="currentColor" /> Browse playlists
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Info tip */}
        <div className="mt-8 rounded-2xl border border-brand/15 bg-brand-tint/50 p-4">
          <p className="text-[13px] text-brand-darker font-medium">
            💡 <strong>Tip:</strong> Start with DILR — over 412 sets covering all major CAT categories.
          </p>
        </div>
      </div>
    </div>
  );
}
