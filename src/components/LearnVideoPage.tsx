"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Play, Search, Video } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { Video as VideoType, ModuleVideos } from "@/lib/videoData";

interface Props {
  section: string;
  subtitle: string;
  modules: ModuleVideos;
  backHref?: string;
}

function ytThumb(videoId: string | null) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

function VideoCard({
  video,
  index,
  done,
}: {
  video: VideoType;
  index: number;
  done: boolean;
}) {
  const thumb = ytThumb(video.videoId);
  // Keep every Learn lesson in the in-site player. The fallback stays internal
  // too, rather than sending a learner to a new YouTube tab.
  const href = video.videoId ? `/learn/watch?v=${video.videoId}` : "/learn";

  return (
    <Link
      href={href}
      className={`group flex gap-3 rounded-xl border p-3 transition hover:shadow-md hover:shadow-brand/10 ${
        done
          ? "border-brand/30 bg-brand-tint/40"
          : "border-border bg-white hover:border-brand/40"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-[112px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-darker to-brand-dark">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video size={20} className="text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
            <Play size={14} className="ml-0.5 text-brand-darker" fill="currentColor" />
          </div>
        </div>
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-bold text-white">
            {video.duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* Checkmark / number badge */}
          {done ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
          ) : (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand-darker">
              {index + 1}
            </span>
          )}
          <p className={`line-clamp-2 text-[13px] font-semibold leading-snug group-hover:text-brand-darker ${done ? "text-muted line-through" : "text-foreground"}`}>
            {video.title}
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-7">
          <span className="text-[11px] text-muted">{video.channel}</span>
          {video.seq && (
            <span className="rounded-full bg-brand-tint/70 px-2 py-0.5 text-[10px] font-semibold text-brand-darker">
              {video.seq}
            </span>
          )}
          {done && (
            <span className="rounded-full bg-brand text-white px-2 py-0.5 text-[10px] font-bold">
              ✓ Done
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ChapterAccordion({
  chapter,
  videos,
  defaultOpen,
  completedIds,
}: {
  chapter: string;
  videos: VideoType[];
  defaultOpen?: boolean;
  completedIds: Set<string>;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const doneCount = videos.filter((v) => v.videoId && completedIds.has(v.videoId)).length;
  const allDone = doneCount === videos.length && videos.length > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${allDone ? "border-brand/30 bg-brand-tint/20" : "border-border bg-white"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-tint/30 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          {allDone ? (
            <CheckCircle2 size={15} className="shrink-0 text-brand" />
          ) : (
            <BookOpen size={15} className="shrink-0 text-brand-darker" />
          )}
          <span className="font-semibold text-[14px] text-foreground truncate">{chapter}</span>
          <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-bold text-brand-darker">
            {videos.length} videos
          </span>
          {doneCount > 0 && (
            <span className="shrink-0 rounded-full bg-brand text-white px-2.5 py-0.5 text-[10px] font-bold">
              {doneCount}/{videos.length}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4 flex flex-col gap-2.5">
          {videos.map((v, i) => (
            <VideoCard
              key={`${v.url}-${i}`}
              video={v}
              index={i}
              done={!!(v.videoId && completedIds.has(v.videoId))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearnVideoPage({ section, subtitle, modules, backHref = "/learn" }: Props) {
  const [search, setSearch] = useState("");
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const moduleNames = Object.keys(modules);
  const currentModule = activeModule ?? moduleNames[0];

  /* auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* load all completed video IDs for this section */
  useEffect(() => {
    if (!user) { setCompletedIds(new Set()); return; }
    let active = true;
    getDocs(
      query(
        collection(db, "video_progress"),
        where("userId", "==", user.uid),
        where("completed", "==", true),
        where("section", "==", section),
      )
    ).then((snap) => {
      if (!active) return;
      setCompletedIds(new Set(snap.docs.map((d) => String(d.data().videoId))));
    });
    return () => { active = false; };
  }, [user, section]);

  const chapters = useMemo(() => {
    const mod = modules[currentModule] ?? {};
    if (!search.trim()) return mod;
    const q = search.toLowerCase();
    const filtered: Record<string, VideoType[]> = {};
    Object.entries(mod).forEach(([ch, vids]) => {
      const matchedVids = vids.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          ch.toLowerCase().includes(q) ||
          v.channel.toLowerCase().includes(q)
      );
      if (matchedVids.length) filtered[ch] = matchedVids;
    });
    return filtered;
  }, [currentModule, modules, search]);

  const totalVideos = useMemo(
    () => Object.values(modules[currentModule] ?? {}).reduce((sum, v) => sum + v.length, 0),
    [currentModule, modules]
  );

  const totalDone = useMemo(() => {
    let n = 0;
    Object.values(modules[currentModule] ?? {}).forEach((vids) =>
      vids.forEach((v) => { if (v.videoId && completedIds.has(v.videoId)) n++; })
    );
    return n;
  }, [currentModule, modules, completedIds]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Back */}
        <Link href={backHref} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker transition">
          <ArrowLeft size={14} /> Back to Learn
        </Link>

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[24px] font-bold text-foreground">{section}</h1>
            <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>
          </div>
          {user && totalDone > 0 && (
            <div className="shrink-0 text-right">
              <p className="font-display text-[22px] font-black text-brand">{totalDone}<span className="text-[15px] text-muted font-semibold">/{totalVideos}</span></p>
              <p className="text-[11px] text-muted">completed</p>
            </div>
          )}
        </div>

        {/* Module tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {moduleNames.map((mod) => {
            const count = Object.values(modules[mod] ?? {}).reduce((s, v) => s + v.length, 0);
            return (
              <button
                key={mod}
                onClick={() => { setActiveModule(mod); setSearch(""); }}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  currentModule === mod
                    ? "bg-brand text-white shadow-md shadow-brand/25"
                    : "border border-border bg-white text-muted hover:border-brand hover:text-brand-darker"
                }`}
              >
                {mod}
                <span className={`ml-1.5 text-[11px] ${currentModule === mod ? "opacity-80" : "text-brand-darker"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="search-bar mb-5 max-w-md">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${currentModule}…`}
            className="flex-1 bg-transparent text-[13.5px] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[11px] text-muted hover:text-brand-darker font-semibold">
              Clear
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="mb-4 flex items-center gap-3 text-[12.5px] text-muted">
          <ChevronRight size={13} className="text-brand-darker" />
          <span>
            {search ? (
              <><strong className="text-foreground">{Object.values(chapters).reduce((s, v) => s + v.length, 0)}</strong> matching videos in {Object.keys(chapters).length} chapters</>
            ) : (
              <><strong className="text-foreground">{totalVideos}</strong> videos · {Object.keys(modules[currentModule] ?? {}).length} chapters · <strong className="text-brand-darker">{totalDone} completed</strong></>
            )}
          </span>
        </div>

        {/* Progress bar for module */}
        {!search && totalVideos > 0 && user && (
          <div className="mb-5 h-2 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${(totalDone / totalVideos) * 100}%` }}
            />
          </div>
        )}

        {/* Chapter accordion list */}
        <div className="flex flex-col gap-3">
          {Object.keys(chapters).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-[14px] font-semibold text-foreground">No videos found</p>
              <p className="mt-1 text-[13px] text-muted">Try a different search term.</p>
            </div>
          ) : (
            Object.entries(chapters).map(([chapter, videos], i) => (
              <ChapterAccordion
                key={chapter}
                chapter={chapter}
                videos={videos}
                defaultOpen={i === 0 && !search}
                completedIds={completedIds}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
