"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ExternalLink, Play, PlayCircle, Search, Video } from "lucide-react";
import videoData from "@/lib/videoData";
import type { Video as VideoType } from "@/lib/videoData";

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
    chapters: 8,
    sets: 114,
    tags: ["Past Year", "CAT 2017–2024", "~37 hrs"],
    available: true,
  },
];

function ytThumb(videoId: string | null) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

function VideoCard({ video, index }: { video: VideoType; index: number }) {
  const thumb = ytThumb(video.videoId);
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-xl border border-border bg-white p-3 transition hover:border-brand/40 hover:shadow-md hover:shadow-brand/10"
    >
      <div className="relative h-16 w-[112px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-darker to-brand-dark">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Video size={20} className="text-white/60" /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
            <Play size={14} className="ml-0.5 text-brand-darker" fill="currentColor" />
          </div>
        </div>
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-bold text-white">{video.duration}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand-darker">{index + 1}</span>
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground group-hover:text-brand-darker">{video.title}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-7">
          <span className="text-[11px] text-muted">{video.channel}</span>
          {video.seq && <span className="rounded-full bg-brand-tint/70 px-2 py-0.5 text-[10px] font-semibold text-brand-darker">{video.seq}</span>}
        </div>
      </div>
      <ExternalLink size={13} className="mt-1 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
    </a>
  );
}

function ChapterAccordion({ chapter, videos, defaultOpen }: { chapter: string; videos: VideoType[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-tint/30 transition">
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen size={15} className="shrink-0 text-brand-darker" />
          <span className="font-semibold text-[14px] text-foreground truncate">{chapter}</span>
          <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-bold text-brand-darker">{videos.length} videos</span>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4 flex flex-col gap-2.5">
          {videos.map((v, i) => <VideoCard key={`${v.url}-${i}`} video={v} index={i} />)}
        </div>
      )}
    </div>
  );
}

type TabType = "playlists" | "conceptual";

export default function DilrLearnPage() {
  const [activeTab, setActiveTab] = useState<TabType>("conceptual");
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const dilrData = videoData["DILR"] ?? {};
  const moduleNames = Object.keys(dilrData);
  const currentModule = activeModule ?? moduleNames[0];

  const chapters = useMemo(() => {
    const mod = dilrData[currentModule] ?? {};
    if (!search.trim()) return mod;
    const q = search.toLowerCase();
    const filtered: Record<string, VideoType[]> = {};
    Object.entries(mod).forEach(([ch, vids]) => {
      const matched = vids.filter(v => v.title.toLowerCase().includes(q) || ch.toLowerCase().includes(q));
      if (matched.length) filtered[ch] = matched;
    });
    return filtered;
  }, [currentModule, dilrData, search]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/learn" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker transition">
          <ArrowLeft size={14} /> Back to Learn
        </Link>

        <div className="mb-6">
          <h1 className="font-display text-[24px] font-bold text-foreground">DILR</h1>
          <p className="mt-1 text-[13.5px] text-muted">Data Interpretation & Logical Reasoning — concept videos and chapter-wise practice sets.</p>
        </div>

        {/* Main tabs */}
        <div className="mb-6 flex gap-2">
          {([["conceptual", "📹 Conceptual Videos (149)"], ["playlists", "📚 Practice Playlists"]] as [TabType, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition ${activeTab === tab ? "bg-brand text-white shadow-md shadow-brand/25" : "border border-border bg-white text-muted hover:border-brand hover:text-brand-darker"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* CONCEPTUAL VIDEOS TAB */}
        {activeTab === "conceptual" && (
          <>
            {/* Module tabs */}
            <div className="mb-5 flex flex-wrap gap-2">
              {moduleNames.map((mod) => {
                const count = Object.values(dilrData[mod] ?? {}).reduce((s, v) => s + v.length, 0);
                return (
                  <button key={mod} onClick={() => { setActiveModule(mod); setSearch(""); }} className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${currentModule === mod ? "bg-brand text-white shadow-md shadow-brand/25" : "border border-border bg-white text-muted hover:border-brand hover:text-brand-darker"}`}>
                    {mod} <span className={`ml-1.5 text-[11px] ${currentModule === mod ? "opacity-80" : "text-brand-darker"}`}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="search-bar mb-5 max-w-md">
              <Search size={15} className="text-muted shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search in ${currentModule}…`} className="flex-1 bg-transparent text-[13.5px] outline-none" />
              {search && <button onClick={() => setSearch("")} className="text-[11px] text-muted hover:text-brand-darker font-semibold">Clear</button>}
            </div>

            <div className="flex flex-col gap-3">
              {Object.keys(chapters).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                  <p className="text-[14px] font-semibold text-foreground">No videos found</p>
                  <p className="mt-1 text-[13px] text-muted">Try a different search term.</p>
                </div>
              ) : Object.entries(chapters).map(([chapter, videos], i) => (
                <ChapterAccordion key={chapter} chapter={chapter} videos={videos} defaultOpen={i === 0 && !search} />
              ))}
            </div>
          </>
        )}

        {/* PLAYLISTS TAB */}
        {activeTab === "playlists" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {DILR_PLAYLISTS.map((pl) => pl.available ? (
              <Link key={pl.id} href={pl.href} className="glass-card group flex flex-col gap-4 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/[0.08]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/25">
                  <PlayCircle size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-display text-[18px] font-bold text-foreground">{pl.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{pl.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pl.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[10.5px] font-semibold text-brand-darker">{tag}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-[12.5px] font-semibold text-brand-dark">{pl.chapters} chapters · {pl.sets} sets</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-dark opacity-0 transition group-hover:opacity-100">
                  Start learning <ArrowRight size={13} />
                </span>
              </Link>
            ) : (
              <div key={pl.id} className="glass-card flex flex-col gap-4 p-6 opacity-60">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-tint to-brand/10 text-brand-dark">
                  <PlayCircle size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-display text-[18px] font-bold text-foreground">{pl.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{pl.subtitle}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-darker">Coming Soon</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
