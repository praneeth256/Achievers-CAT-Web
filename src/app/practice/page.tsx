"use client";

import Link from "next/link";
import { ArrowRight, CheckSquare } from "lucide-react";

const SECTIONS = [
  {
    key: "quant",
    label: "Quantitative Aptitude",
    shortLabel: "QA",
    desc: "Arithmetic · Algebra · Number System · Geometry",
    href: "/practice/quiz?section=Quant",
    icon: "🔢",
    color: "from-blue-400/20 to-blue-600/10",
    border: "hover:border-blue-300",
    badge: "bg-blue-50 text-blue-700",
    count: "Chapter-wise practice questions",
  },
  {
    key: "dilr",
    label: "DILR",
    shortLabel: "DILR",
    desc: "Data Interpretation & Logical Reasoning",
    href: "/practice/quiz?section=DILR",
    icon: "📊",
    color: "from-emerald-400/20 to-emerald-600/10",
    border: "hover:border-emerald-300",
    badge: "bg-emerald-50 text-emerald-700",
    count: "Sets & standalone questions",
  },
  {
    key: "varc",
    label: "VARC",
    shortLabel: "VARC",
    desc: "Verbal Ability & Reading Comprehension",
    href: "/practice/quiz?section=VARC",
    icon: "📖",
    color: "from-purple-400/20 to-purple-600/10",
    border: "hover:border-purple-300",
    badge: "bg-purple-50 text-purple-700",
    count: "VA, RC & critical reasoning",
  },
];

/* ── Inline SVG cartoon kid with blinking eyes & floating question mark ── */
function CartoonKid() {
  return (
    <div className="relative flex flex-col items-center select-none" aria-hidden="true">
      {/* Floating question mark above head */}
      <div className="kid-qmark kid-qmark-intro mb-1 flex items-center justify-center">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          {/* Glow circle */}
          <circle cx="26" cy="26" r="24" fill="rgba(29,185,84,0.10)" />
          {/* ? mark */}
          <text
            x="26"
            y="36"
            textAnchor="middle"
            fontSize="32"
            fontWeight="900"
            fontFamily="Inter, sans-serif"
            fill="#1db954"
          >
            ?
          </text>
        </svg>
      </div>

      {/* Kid body — inline SVG cartoon */}
      <div className="kid-float">
        <div className="kid-sway">
          <svg width="120" height="160" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Shadow */}
            <ellipse cx="60" cy="158" rx="28" ry="5" fill="rgba(0,0,0,0.08)" />

            {/* Body */}
            <rect x="32" y="80" width="56" height="52" rx="14" fill="#4ade80" />
            {/* Collar stripe */}
            <rect x="46" y="80" width="28" height="8" rx="4" fill="#16a34a" />
            {/* Backpack */}
            <rect x="76" y="86" width="20" height="30" rx="8" fill="#fbbf24" />
            <rect x="80" y="90" width="12" height="8" rx="4" fill="#f59e0b" />

            {/* Neck */}
            <rect x="50" y="70" width="20" height="14" rx="7" fill="#fcd5a8" />

            {/* Head */}
            <ellipse cx="60" cy="55" rx="26" ry="25" fill="#fde3b8" />

            {/* Hair */}
            <ellipse cx="60" cy="32" rx="26" ry="13" fill="#92400e" />
            <rect x="34" y="32" width="52" height="10" rx="0" fill="#92400e" />
            {/* Hair tufts */}
            <ellipse cx="46" cy="31" rx="8" ry="5" fill="#78350f" />
            <ellipse cx="60" cy="28" rx="9" ry="6" fill="#78350f" />
            <ellipse cx="74" cy="31" rx="8" ry="5" fill="#78350f" />

            {/* Eyes — with blink animation via CSS */}
            <g className="kid-eye">
              <ellipse cx="50" cy="54" rx="5" ry="6" fill="#1e293b" />
              <ellipse cx="70" cy="54" rx="5" ry="6" fill="#1e293b" />
            </g>
            {/* Eye shine */}
            <circle cx="52" cy="51" r="2" fill="white" />
            <circle cx="72" cy="51" r="2" fill="white" />

            {/* Eyebrows — raised in curious expression */}
            <path d="M44 44 Q50 40 56 44" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M64 44 Q70 40 76 44" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Nose */}
            <ellipse cx="60" cy="61" rx="3" ry="2" fill="#f5a05a" />

            {/* Mouth — small open 'o' of surprise */}
            <path d="M53 68 Q60 73 67 68" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Left arm */}
            <rect x="10" y="82" width="22" height="12" rx="6" fill="#4ade80" transform="rotate(20 10 82)" />
            <ellipse cx="18" cy="103" rx="8" ry="8" fill="#fde3b8" />
            {/* Right arm — waving */}
            <rect x="88" y="82" width="22" height="12" rx="6" fill="#4ade80" transform="rotate(-30 88 82)" />
            <ellipse cx="104" cy="97" rx="8" ry="8" fill="#fde3b8" />

            {/* Legs */}
            <rect x="38" y="128" width="18" height="28" rx="9" fill="#1d4ed8" />
            <rect x="64" y="128" width="18" height="28" rx="9" fill="#1d4ed8" />
            {/* Shoes */}
            <ellipse cx="47" cy="156" rx="12" ry="6" fill="#1e293b" />
            <ellipse cx="73" cy="156" rx="12" ry="6" fill="#1e293b" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function PracticeSelectorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
                <CheckSquare size={18} />
              </span>
              <h1 className="font-display text-[24px] font-bold text-foreground">Practice</h1>
            </div>
            <p className="mt-1 text-[13.5px] text-muted ml-12">
              Choose a section to practice chapter-wise questions.
            </p>
          </div>
        </div>

        {/* Cartoon kid + prompt */}
        <div className="flex flex-col items-center gap-3 my-8">
          <CartoonKid />
          <p className="mt-4 text-[15px] font-semibold text-foreground text-center">
            Which section do you want to practice today?
          </p>
          <p className="text-[13px] text-muted text-center max-w-xs">
            Pick one of the three CAT sections below and get started!
          </p>
        </div>

        {/* Section cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {SECTIONS.map((s, i) => (
            <Link
              key={s.key}
              href={s.href}
              className={`edu-card overflow-hidden group block border border-border ${s.border} transition-all`}
              style={{ animationDelay: `${i * 80}ms` }}
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
                <p className="text-[12px] font-semibold text-brand-dark mb-3">{s.count}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-darker">
                  Start practising <ArrowRight size={12} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Also link PYQs */}
        <div className="mt-6 rounded-2xl border border-brand/15 bg-brand-tint/50 p-4 flex items-center justify-between gap-4">
          <p className="text-[13px] text-brand-darker font-medium">
            📝 <strong>CAT PYQs:</strong> Want to practice actual past-year questions?
          </p>
          <Link
            href="/practice/pyqs"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand-dark transition"
          >
            Go to PYQs <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
