"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import {
  getPYQEmbedUrl,
  getPYQThumbUrl,
  TOTAL_PYQ_SETS,
  PYQ_YEARS,
  type PYQSet,
  type PYQYear,
} from "@/lib/pyqData";

/* ─── Slot colour map ────────────────────────────────────────────────── */
const SLOT_BG: Record<string, string> = {
  "Slot 1": "bg-emerald-500",
  "Slot 2": "bg-blue-500",
  "Slot 3": "bg-amber-500",
};
const SLOT_TEXT: Record<string, string> = {
  "Slot 1": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Slot 2": "text-blue-700 bg-blue-50 border-blue-200",
  "Slot 3": "text-amber-700 bg-amber-50 border-amber-200",
};

/* ─── Video player ───────────────────────────────────────────────────── */
function VideoPlayer({
  item,
  year,
  slot,
}: {
  item: PYQSet;
  year: string;
  slot: string;
}) {
  const embedUrl = getPYQEmbedUrl(item.url);
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-2xl bg-foreground/5 shadow-lg shadow-black/10"
        style={{ aspectRatio: "16/9" }}
      >
        {embedUrl ? (
          <iframe
            key={item.url}
            src={embedUrl}
            title={item.topic}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full rounded-2xl border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlayCircle size={48} className="text-muted/30" />
          </div>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          CAT {year} · {slot} · Set {item.set}
        </p>
        <h2 className="mt-0.5 font-display text-[17px] font-bold leading-snug text-foreground">
          {item.topic}
        </h2>
        <div className="mt-1.5 flex items-center gap-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${SLOT_TEXT[slot] ?? "text-muted bg-white border-border"}`}
          >
            {slot}
          </span>
          {item.duration && (
            <span className="flex items-center gap-1 text-[12px] text-muted">
              <Clock size={11} />
              {item.duration}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Set row ────────────────────────────────────────────────────────── */
function SetRow({
  item,
  slot,
  isPlaying,
  isCompleted,
  onPlay,
  onToggle,
}: {
  item: PYQSet;
  slot: string;
  isPlaying: boolean;
  isCompleted: boolean;
  onPlay: () => void;
  onToggle: (e: React.MouseEvent) => void;
}) {
  const thumb = getPYQThumbUrl(item.url);
  return (
    <div
      onClick={onPlay}
      className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all duration-150 ${
        isPlaying
          ? "border-brand/30 bg-brand-tint"
          : "border-transparent hover:border-border/60 hover:bg-white/60"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
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
          {item.topic}
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

      {/* Slot dot */}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${SLOT_BG[slot] ?? "bg-muted"}`}
      />

      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded-full p-1 transition hover:bg-brand-tint"
        title={isCompleted ? "Mark as not watched" : "Mark as watched"}
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

/* ─── Year card (sidebar) ────────────────────────────────────────────── */
function YearCard({
  yearData,
  isActive,
  doneCount,
  onClick,
}: {
  yearData: PYQYear;
  isActive: boolean;
  doneCount: number;
  onClick: () => void;
}) {
  const total = yearData.slots.reduce((s, sl) => s + sl.items.length, 0);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = doneCount === total && total > 0;

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
        <span className="font-display text-[16px] font-bold">
          CAT {yearData.year}
        </span>
        {allDone && <CheckCircle2 size={14} className="text-brand" />}
        <span className="ml-auto text-[11px] text-muted">{total} sets</span>
      </div>
      {/* slot mini bar */}
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-brand/10">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[10px] text-muted">{doneCount}/{total} watched</p>
    </button>
  );
}

/* ─── Inner (uses no server-only hooks) ─────────────────────────────── */
function GoatCatPlayer() {
  const [activeYearIdx, setActiveYearIdx] = useState(0);
  const [activeItem, setActiveItem] = useState<{ item: PYQSet; slot: string } | null>(null);
  const [search, setSearch] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [progressLoading, setProgressLoading] = useState(true);

  /* Auth */
  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  /* Load Firestore progress */
  useEffect(() => {
    if (!uid) { setCompleted({}); setProgressLoading(false); return; }
    setProgressLoading(true);
    getDoc(doc(db, "learn_progress", `${uid}_dilr_pyq`))
      .then((snap) => setCompleted((snap.data()?.completed as Record<string, boolean>) ?? {}))
      .catch(() => setCompleted({}))
      .finally(() => setProgressLoading(false));
  }, [uid]);

  /* Debounced save */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveProgress = useCallback(
    (next: Record<string, boolean>) => {
      if (!uid) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void setDoc(
          doc(db, "learn_progress", `${uid}_dilr_pyq`),
          { completed: next },
          { merge: true }
        );
      }, 800);
    },
    [uid]
  );

  const toggleDone = useCallback(
    (key: string) => {
      setCompleted((prev) => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = true;
        saveProgress(next);
        return next;
      });
    },
    [saveProgress]
  );

  /* Filtered years */
  const q = search.trim().toLowerCase();
  const filteredYears = q
    ? PYQ_YEARS.filter(
        (y) =>
          y.year.includes(q) ||
          y.slots.some(
            (sl) =>
              sl.slot.toLowerCase().includes(q) ||
              sl.items.some(
                (it) =>
                  it.topic.toLowerCase().includes(q) ||
                  String(it.set).includes(q)
              )
          )
      )
    : PYQ_YEARS;

  const activeYear = filteredYears[activeYearIdx] ?? filteredYears[0] ?? null;

  /* Auto-select first video when year changes */
  useEffect(() => {
    if (activeYear) {
      const firstSlot = activeYear.slots[0];
      const firstItem = firstSlot?.items[0];
      if (firstItem) setActiveItem({ item: firstItem, slot: firstSlot.slot });
    }
  }, [activeYearIdx, activeYear]);

  useEffect(() => { setActiveYearIdx(0); }, [search]);

  const totalDone = Object.keys(completed).length;

  /* Year done count */
  const yearDone = (y: PYQYear) =>
    y.slots.reduce(
      (s, sl) => s + sl.items.filter((it) => completed[`${it.url}-${it.set}`]).length,
      0
    );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-[13px] text-muted">
        <Link href="/learn" className="font-medium hover:text-brand-darker">Learn</Link>
        <span>/</span>
        <Link href="/learn/dilr" className="font-medium hover:text-brand-darker">DILR</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">GOAT CAT — PYQs</span>
      </div>

      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
          DILR · GOAT CAT · CAT 2017–2024
        </p>
        <h1 className="mt-1 font-display text-[22px] font-black text-foreground">
          All 114 DILR Sets — Past Year Questions
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Every DILR set from CAT 2017–2024, fully solved on video · ~37 hrs
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* ── Sidebar ── */}
        <aside
          className="glass-card-solid shrink-0 p-3 lg:w-64 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Progress */}
          <div className="mb-3 rounded-xl bg-brand-tint/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">
                Your progress
              </p>
              {progressLoading && (
                <Loader2 size={12} className="animate-spin text-brand" />
              )}
            </div>
            <p className="mt-0.5 text-[13px] font-semibold text-foreground">
              <span className="text-brand-darker">{totalDone}</span>
              <span className="text-muted"> / {TOTAL_PYQ_SETS} sets watched</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark transition-all duration-700"
                style={{ width: `${Math.round((totalDone / TOTAL_PYQ_SETS) * 100)}%` }}
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search year, topic, set…"
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

          {/* Legend */}
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {[["Slot 1", "bg-emerald-500"], ["Slot 2", "bg-blue-500"], ["Slot 3", "bg-amber-500"]].map(
              ([label, cls]) => (
                <span key={label} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                  <span className={`h-2 w-2 rounded-full ${cls}`} />
                  {label}
                </span>
              )
            )}
          </div>

          {/* Year list */}
          <div className="space-y-0.5">
            {filteredYears.length === 0 && (
              <p className="py-6 text-center text-[12px] text-muted">No results.</p>
            )}
            {filteredYears.map((y, idx) => (
              <YearCard
                key={y.year}
                yearData={y}
                isActive={activeYearIdx === idx}
                doneCount={yearDone(y)}
                onClick={() => setActiveYearIdx(idx)}
              />
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="min-w-0 flex-1 space-y-4">

          {/* Player */}
          {activeItem && activeYear && (
            <div className="glass-card-solid p-4 sm:p-5">
              <VideoPlayer
                item={activeItem.item}
                year={activeYear.year}
                slot={activeItem.slot}
              />
            </div>
          )}

          {/* Slot groups */}
          {activeYear && (
            <div className="glass-card-solid p-4 sm:p-5">
              <div className="mb-4">
                <h2 className="font-display text-[16px] font-bold text-foreground">
                  CAT {activeYear.year}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  {activeYear.slots.reduce((s, sl) => s + sl.items.length, 0)} sets ·{" "}
                  {yearDone(activeYear)} watched
                </p>
              </div>

              <div className="space-y-5">
                {activeYear.slots.map((sl) => (
                  <div key={sl.slot}>
                    {/* Slot header */}
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${SLOT_BG[sl.slot] ?? "bg-muted"}`}
                      />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        {sl.slot} · {sl.items.length} sets
                      </p>
                    </div>
                    <div className="space-y-1">
                      {sl.items.map((item) => {
                        const key = `${item.url}-${item.set}`;
                        return (
                          <SetRow
                            key={key}
                            item={item}
                            slot={sl.slot}
                            isPlaying={
                              activeItem?.item.url === item.url &&
                              activeItem?.slot === sl.slot
                            }
                            isCompleted={!!completed[key]}
                            onPlay={() => setActiveItem({ item, slot: sl.slot })}
                            onToggle={(e) => {
                              e.stopPropagation();
                              toggleDone(key);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GoatCatPYQsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      }
    >
      <GoatCatPlayer />
    </Suspense>
  );
}
