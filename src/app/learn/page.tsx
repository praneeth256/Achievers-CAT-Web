"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import {
  DILR_CHAPTERS,
  LOD_LABEL,
  LOD_ORDER,
  TOTAL_DILR_SETS,
  type Chapter,
  type LodKey,
  type VideoItem,
  getEmbedUrl,
  getThumbUrl,
  getYouTubeId,
} from "@/lib/learnData";

/* ─── Types ─────────────────────────────────────────────────────────── */
type Subject = "dilr" | "quant" | "varc";

const SUBJECT_LABELS: Record<Subject, string> = {
  dilr: "DILR",
  quant: "Quant",
  varc: "VARC",
};

const LOD_COLORS: Record<LodKey, string> = {
  E: "bg-emerald-500",
  M: "bg-blue-500",
  MD: "bg-amber-500",
  D: "bg-red-500",
};

const LOD_TEXT: Record<LodKey, string> = {
  E: "text-emerald-700 bg-emerald-50 border-emerald-200",
  M: "text-blue-700 bg-blue-50 border-blue-200",
  MD: "text-amber-700 bg-amber-50 border-amber-200",
  D: "text-red-700 bg-red-50 border-red-200",
};

/* ─── YouTube embed ──────────────────────────────────────────────────── */
function VideoPlayer({
  video,
  chapterName,
}: {
  video: VideoItem;
  chapterName: string;
}) {
  const embedUrl = getEmbedUrl(video.url);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-foreground/5 shadow-lg shadow-black/10"
        style={{ aspectRatio: "16/9" }}
      >
        {embedUrl ? (
          <iframe
            key={video.url}
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full rounded-2xl border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <PlayCircle size={48} className="opacity-30" />
          </div>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          {chapterName} · Set {video.set}
        </p>
        <h2 className="mt-0.5 font-display text-[16px] font-bold leading-snug text-foreground">
          {video.title}
        </h2>
        <div className="mt-1.5 flex items-center gap-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${LOD_TEXT[video.lod]}`}
          >
            {LOD_LABEL[video.lod]}
          </span>
          {video.duration && (
            <span className="flex items-center gap-1 text-[12px] text-muted">
              <Clock size={11} />
              {video.duration}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Lesson row ─────────────────────────────────────────────────────── */
function LessonRow({
  item,
  index,
  total,
  isPlaying,
  isCompleted,
  onPlay,
  onToggle,
}: {
  item: VideoItem;
  index: number;
  total: number;
  isPlaying: boolean;
  isCompleted: boolean;
  onPlay: () => void;
  onToggle: (e: React.MouseEvent) => void;
}) {
  const thumb = getThumbUrl(item.url);
  return (
    <div
      className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all duration-150 ${
        isPlaying
          ? "border-brand/30 bg-brand-tint"
          : "border-transparent hover:border-border/60 hover:bg-white/60"
      }`}
      onClick={onPlay}
    >
      {/* Thumbnail */}
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlayCircle size={20} className="text-muted/40" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-brand/70">
            <PlayCircle size={18} className="text-white" fill="white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-[12.5px] font-semibold leading-snug ${
            isCompleted ? "line-through opacity-60" : "text-foreground"
          } ${isPlaying ? "text-brand-darker" : ""}`}
        >
          {item.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {isPlaying ? (
            <span className="font-bold text-brand-dark">Now playing</span>
          ) : (
            <>Set {item.set}</>
          )}
          {item.duration && <> · {item.duration}</>}
        </p>
      </div>

      {/* Check */}
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded-full p-1 transition hover:bg-brand-tint"
        title={isCompleted ? "Mark as not done" : "Mark as done"}
      >
        {isCompleted ? (
          <CheckCircle2 size={18} className="text-brand" />
        ) : (
          <Circle size={18} className="text-border" />
        )}
      </button>
    </div>
  );
}

/* ─── Chapter row in sidebar ─────────────────────────────────────────── */
function ChapterRow({
  chapter,
  index,
  isActive,
  doneCount,
  onClick,
}: {
  chapter: Chapter;
  index: number;
  isActive: boolean;
  doneCount: number;
  onClick: () => void;
}) {
  const total = chapter.items.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = doneCount === total;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
        isActive
          ? "bg-brand-tint text-brand-darker shadow-sm shadow-brand/10"
          : "text-foreground/75 hover:bg-white/70 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-display text-[10px] font-bold ${
            isActive ? "text-brand-dark" : "text-muted"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {chapter.name}
        </span>
        {allDone && doneCount > 0 && (
          <CheckCircle2 size={14} className="shrink-0 text-brand" />
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-brand/10">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-muted">
          {doneCount}/{total}
        </span>
      </div>
    </button>
  );
}

/* ─── Coming Soon panel ──────────────────────────────────────────────── */
function ComingSoon({ subject }: { subject: Subject }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark">
        <Sparkles size={28} />
      </div>
      <div>
        <p className="font-display text-[20px] font-bold text-foreground">
          {SUBJECT_LABELS[subject]} — Coming Soon
        </p>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-muted">
          We're curating chapter-wise video content for {SUBJECT_LABELS[subject]}. Stay tuned!
        </p>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */
function LearnPageInner() {
  const searchParams = useSearchParams();
  const initialSubject = (searchParams.get("subject") as Subject) ?? "dilr";

  const [subject, setSubject] = useState<Subject>(initialSubject);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [search, setSearch] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [progressLoading, setProgressLoading] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  /* Auth */
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
  }, []);

  /* Load progress from Firestore */
  useEffect(() => {
    if (!uid) { setCompleted({}); setProgressLoading(false); return; }
    setProgressLoading(true);
    getDoc(doc(db, "learn_progress", `${uid}_dilr`))
      .then((snap) => {
        setCompleted((snap.data()?.completed as Record<string, boolean>) ?? {});
      })
      .catch(() => setCompleted({}))
      .finally(() => setProgressLoading(false));
  }, [uid]);

  /* Save progress to Firestore (debounced via ref) */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveProgress = useCallback(
    (next: Record<string, boolean>) => {
      if (!uid) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void setDoc(
          doc(db, "learn_progress", `${uid}_dilr`),
          { completed: next },
          { merge: true }
        );
      }, 800);
    },
    [uid]
  );

  /* Toggle completion */
  const toggleDone = useCallback(
    (url: string) => {
      setCompleted((prev) => {
        const next = { ...prev };
        if (next[url]) delete next[url];
        else next[url] = true;
        saveProgress(next);
        return next;
      });
    },
    [saveProgress]
  );

  /* Filtered chapters */
  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DILR_CHAPTERS;
    return DILR_CHAPTERS.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.items.some((it) => it.title.toLowerCase().includes(q))
    );
  }, [search]);

  const activeChapter =
    filteredChapters[activeChapterIdx] ?? filteredChapters[0] ?? null;

  /* When chapter changes, default to first video */
  useEffect(() => {
    if (activeChapter) setActiveVideo(activeChapter.items[0] ?? null);
  }, [activeChapterIdx, activeChapter]);

  /* When search changes, reset to first visible chapter */
  useEffect(() => {
    setActiveChapterIdx(0);
  }, [search]);

  /* Stats */
  const totalDone = Object.keys(completed).length;

  /* Group active chapter videos by LOD */
  const groupedVideos = useMemo(() => {
    if (!activeChapter) return [];
    const groups: { lod: LodKey; items: VideoItem[] }[] = [];
    for (const lod of LOD_ORDER) {
      const items = activeChapter.items.filter((it) => it.lod === lod);
      if (items.length) groups.push({ lod, items });
    }
    return groups;
  }, [activeChapter]);

  /* ── Render ── */
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">

      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          Chapter-wise video learning
        </p>
        <h1 className="mt-1 font-display text-[26px] font-black text-foreground">
          Learn
        </h1>
      </div>

      {/* Subject tabs */}
      <div className="mb-6 flex gap-2">
        {(["dilr", "quant", "varc"] as Subject[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setSubject(s); setSearch(""); setActiveChapterIdx(0); }}
            className={`rounded-xl px-5 py-2 text-[13.5px] font-semibold transition-all ${
              subject === s
                ? "bg-brand text-white shadow-md shadow-brand/30"
                : "bg-white/70 text-muted hover:bg-brand-tint hover:text-brand-darker border border-border/60"
            }`}
          >
            {SUBJECT_LABELS[s]}
            {s === "dilr" && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  subject === s ? "bg-white/20" : "bg-brand-tint text-brand-darker"
                }`}
              >
                {TOTAL_DILR_SETS} sets
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Coming soon for non-DILR */}
      {subject !== "dilr" ? (
        <div className="glass-card p-8">
          <ComingSoon subject={subject} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

          {/* ── Sidebar ───────────────────────────────────────── */}
          <aside
            ref={sidebarRef}
            className="glass-card-solid shrink-0 p-3 lg:w-72 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* Progress summary */}
            <div className="mb-3 rounded-xl bg-brand-tint/60 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
                  Your progress
                </p>
                {progressLoading && <Loader2 size={12} className="animate-spin text-brand" />}
              </div>
              <p className="mt-0.5 text-[13px] font-semibold text-foreground">
                <span className="text-brand-darker">{totalDone}</span>
                <span className="text-muted"> / {TOTAL_DILR_SETS} sets done</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark transition-all duration-700"
                  style={{ width: `${Math.round((totalDone / TOTAL_DILR_SETS) * 100)}%` }}
                />
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapters…"
                className="w-full rounded-xl border border-border/60 bg-white/70 py-2 pl-8 pr-8 text-[13px] outline-none transition placeholder:text-muted/60 focus:border-brand/40 focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Chapter list */}
            <div className="space-y-0.5">
              {filteredChapters.length === 0 && (
                <p className="py-6 text-center text-[12px] text-muted">No chapters found.</p>
              )}
              {filteredChapters.map((ch, idx) => {
                const doneCount = ch.items.filter((it) => completed[it.url]).length;
                return (
                  <ChapterRow
                    key={ch.name}
                    chapter={ch}
                    index={idx}
                    isActive={activeChapterIdx === idx}
                    doneCount={doneCount}
                    onClick={() => setActiveChapterIdx(idx)}
                  />
                );
              })}
            </div>
          </aside>

          {/* ── Main content ──────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* Video player */}
            {activeVideo && activeChapter && (
              <div className="glass-card-solid p-4 sm:p-5">
                <VideoPlayer video={activeVideo} chapterName={activeChapter.name} />
              </div>
            )}

            {/* Lesson list */}
            {activeChapter && (
              <div className="glass-card-solid p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[15px] font-bold text-foreground">
                      {activeChapter.name}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {activeChapter.items.length} sets ·{" "}
                      {activeChapter.items.filter((it) => completed[it.url]).length} done
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LOD_ORDER.map((lod) => {
                      const count = activeChapter.items.filter((it) => it.lod === lod).length;
                      if (!count) return null;
                      return (
                        <span
                          key={lod}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LOD_TEXT[lod]}`}
                        >
                          {LOD_LABEL[lod]} · {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {groupedVideos.map(({ lod, items }) => (
                    <div key={lod}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${LOD_COLORS[lod]}`} />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                          {LOD_LABEL[lod]} · {items.length}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {items.map((item, idx) => (
                          <LessonRow
                            key={item.url}
                            item={item}
                            index={idx}
                            total={items.length}
                            isPlaying={activeVideo?.url === item.url}
                            isCompleted={!!completed[item.url]}
                            onPlay={() => setActiveVideo(item)}
                            onToggle={(e) => {
                              e.stopPropagation();
                              toggleDone(item.url);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      }
    >
      <LearnPageInner />
    </Suspense>
  );
}
