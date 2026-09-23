"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";

// ── Playlist registry for DILR ────────────────────────────────────────────────
// Add new playlists here when ready — each will appear as a card automatically
const DILR_PLAYLISTS = [
  {
    id: "aptitude-jab",
    title: "Aptitude Jab",
    subtitle: "Chapter-wise DILR Practice",
    href: "/learn/dilr/aptitude-jab",
    chapters: 28,
    sets: 412,
    tags: ["Beginner to Advanced", "CAT Focused"],
    available: true,
  },
  {
    id: "goat-cat-pyqs",
    title: "GOAT CAT — PYQs",
    subtitle: "All 114 DILR Sets · CAT 2017–2024",
    href: "/learn/dilr/goat-cat-pyqs",
    chapters: 8,   // 8 years
    sets: 114,
    tags: ["Past Year", "CAT 2017–2024", "~37 hrs"],
    available: true,
  },
];


export default function DilrPlaylistsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/learn"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker"
      >
        <ArrowLeft size={14} /> Back to Learn
      </Link>

      <div className="mb-10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          DILR · Choose a playlist
        </p>
        <h1 className="mt-1 font-display text-[26px] font-black text-foreground">
          Data Interpretation &amp; Logical Reasoning
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          Pick a playlist to start practising chapter-wise.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DILR_PLAYLISTS.map((pl) => (
          pl.available ? (
            <Link
              key={pl.id}
              href={pl.href}
              className="glass-card group flex flex-col gap-4 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/[0.08]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/25">
                <PlayCircle size={22} />
              </div>
              <div className="flex-1">
                <p className="font-display text-[18px] font-bold text-foreground">
                  {pl.title}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">{pl.subtitle}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[10.5px] font-semibold text-brand-darker"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-[12.5px] font-semibold text-brand-dark">
                  {pl.chapters} chapters · {pl.sets} sets
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-dark opacity-0 transition group-hover:opacity-100">
                Start learning <ArrowRight size={13} />
              </span>
            </Link>
          ) : (
            <div
              key={pl.id}
              className="glass-card flex flex-col gap-4 p-6 opacity-60"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-tint to-brand/10 text-brand-dark">
                <PlayCircle size={22} />
              </div>
              <div className="flex-1">
                <p className="font-display text-[18px] font-bold text-foreground">
                  {pl.title}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">{pl.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[10.5px] font-semibold text-brand-darker"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-darker">
                Coming Soon
              </span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
