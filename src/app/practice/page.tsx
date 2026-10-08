"use client";

import Link from "next/link";
import { ArrowRight, CheckSquare } from "lucide-react";

const SECTIONS = [
  {
    key: "quant",
    label: "Quantitative Aptitude",
    desc: "Arithmetic · Algebra · Number System · Geometry",
    href: "/practice/quiz?section=Quant",
    icon: "🔢",
    color: "from-blue-400/20 to-blue-600/10",
    accent: "hover:border-blue-300 hover:shadow-blue-100",
    count: "Chapter-wise practice questions",
  },
  {
    key: "dilr",
    label: "DILR",
    desc: "Data Interpretation & Logical Reasoning",
    href: "/practice/quiz?section=DILR",
    icon: "📊",
    color: "from-emerald-400/20 to-emerald-600/10",
    accent: "hover:border-emerald-300 hover:shadow-emerald-100",
    count: "Sets & standalone questions",
  },
  {
    key: "varc",
    label: "VARC",
    desc: "Verbal Ability & Reading Comprehension",
    href: "/practice/quiz?section=VARC",
    icon: "📖",
    color: "from-purple-400/20 to-purple-600/10",
    accent: "hover:border-purple-300 hover:shadow-purple-100",
    count: "VA, RC & critical reasoning",
  },
];

/* ── Inline SVG cartoon kid ── */
function CartoonKid() {
  return (
    <div className="relative flex flex-col items-center select-none" aria-hidden="true">
      {/* Floating question mark */}
      <div className="kid-qmark kid-qmark-intro flex items-center justify-center mb-0">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <circle cx="30" cy="30" r="28" fill="rgba(29,185,84,0.10)" />
          <text x="30" y="43" textAnchor="middle" fontSize="38" fontWeight="900"
            fontFamily="Inter, sans-serif" fill="#1db954">?</text>
        </svg>
      </div>

      {/* Kid SVG */}
      <div className="kid-float">
        <div className="kid-sway">
          <svg width="160" height="210" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="158" rx="28" ry="5" fill="rgba(0,0,0,0.08)" />
            <rect x="32" y="80" width="56" height="52" rx="14" fill="#4ade80" />
            <rect x="46" y="80" width="28" height="8" rx="4" fill="#16a34a" />
            <rect x="76" y="86" width="20" height="30" rx="8" fill="#fbbf24" />
            <rect x="80" y="90" width="12" height="8" rx="4" fill="#f59e0b" />
            <rect x="50" y="70" width="20" height="14" rx="7" fill="#fcd5a8" />
            <ellipse cx="60" cy="55" rx="26" ry="25" fill="#fde3b8" />
            <ellipse cx="60" cy="32" rx="26" ry="13" fill="#92400e" />
            <rect x="34" y="32" width="52" height="10" fill="#92400e" />
            <ellipse cx="46" cy="31" rx="8" ry="5" fill="#78350f" />
            <ellipse cx="60" cy="28" rx="9" ry="6" fill="#78350f" />
            <ellipse cx="74" cy="31" rx="8" ry="5" fill="#78350f" />
            <g className="kid-eye">
              <ellipse cx="50" cy="54" rx="5" ry="6" fill="#1e293b" />
              <ellipse cx="70" cy="54" rx="5" ry="6" fill="#1e293b" />
            </g>
            <circle cx="52" cy="51" r="2" fill="white" />
            <circle cx="72" cy="51" r="2" fill="white" />
            <path d="M44 44 Q50 40 56 44" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M64 44 Q70 40 76 44" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="60" cy="61" rx="3" ry="2" fill="#f5a05a" />
            <path d="M53 68 Q60 73 67 68" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="10" y="82" width="22" height="12" rx="6" fill="#4ade80" transform="rotate(20 10 82)" />
            <ellipse cx="18" cy="103" rx="8" ry="8" fill="#fde3b8" />
            <rect x="88" y="82" width="22" height="12" rx="6" fill="#4ade80" transform="rotate(-30 88 82)" />
            <ellipse cx="104" cy="97" rx="8" ry="8" fill="#fde3b8" />
            <rect x="38" y="128" width="18" height="28" rx="9" fill="#1d4ed8" />
            <rect x="64" y="128" width="18" height="28" rx="9" fill="#1d4ed8" />
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
    /* Fill the viewport height minus the topbar (~56px) so nothing requires scrolling */
    <div className="flex items-center bg-background" style={{ minHeight: "calc(100vh - 56px)" }}>
      <div className="w-full mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">

        {/* Two-column: left = content, right = cartoon kid */}
        <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-6 lg:gap-10">

          {/* ── LEFT: header + section cards + pyqs bar ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
                  <CheckSquare size={18} />
                </span>
                <h1 className="font-display text-[22px] font-bold text-foreground">Practice</h1>
              </div>
              <p className="text-[13px] text-muted ml-12">
                Which section do you want to practice today?
              </p>
            </div>

            {/* Section cards — horizontal list on mobile, grid on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SECTIONS.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className={`group block rounded-2xl border border-border bg-white overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${s.accent}`}
                >
                  {/* Coloured top strip */}
                  <div className={`h-16 bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <span className="text-4xl">{s.icon}</span>
                  </div>
                  {/* Body */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="font-display text-[15px] font-bold text-foreground leading-tight">{s.label}</p>
                      <ArrowRight size={14} className="text-muted group-hover:text-brand-darker transition-colors shrink-0" />
                    </div>
                    <p className="text-[11.5px] text-muted mb-1.5 leading-snug">{s.desc}</p>
                    <p className="text-[11px] font-semibold text-brand-dark">{s.count}</p>
                    <div className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold text-brand-darker">
                      Start practising <ArrowRight size={11} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* CAT PYQs bar */}
            <div className="rounded-2xl border border-brand/15 bg-brand-tint/50 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-[13px] text-brand-darker font-medium">
                📝 <strong>CAT PYQs:</strong> Want to practice actual past-year questions?
              </p>
              <Link
                href="/practice/pyqs"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-dark transition"
              >
                Go to PYQs <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* ── RIGHT: cartoon kid — hidden on mobile to save space ── */}
          <div className="hidden lg:flex flex-col items-center justify-center w-52 shrink-0">
            <CartoonKid />
            <p className="mt-2 text-[12px] text-muted text-center font-medium leading-snug max-w-[140px]">
              Pick a section and start practising!
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
