"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function VarcPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <Link href="/learn" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker">
        <ArrowLeft size={14} /> Back to Learn
      </Link>
      <div className="glass-card flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark">
          <Sparkles size={28} />
        </div>
        <div>
          <p className="font-display text-[22px] font-bold text-foreground">VARC — Coming Soon</p>
          <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-muted">
            We&#39;re curating chapter-wise video content for VARC. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
