"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, Save, BookOpen, ChevronRight,
} from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  doc, getDoc, setDoc, serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import videoLookup from "@/lib/videoLookup";
import videoData from "@/lib/videoData";
import type { Video } from "@/lib/videoData";

/* ─── helpers ───────────────────────────────────────────────── */
function backHref(section: string) {
  const map: Record<string, string> = {
    "Quantitative Aptitude": "/learn/quant",
    DILR: "/learn/dilr",
    VARC: "/learn/varc",
  };
  return map[section] ?? "/learn";
}

function sectionShort(section: string) {
  const map: Record<string, string> = {
    "Quantitative Aptitude": "Quant",
    DILR: "DILR",
    VARC: "VARC",
  };
  return map[section] ?? section;
}

/* ─── chapter sibling list ──────────────────────────────────── */
function chapterVideos(section: string, module_: string, chapter: string): Video[] {
  return videoData[section]?.[module_]?.[chapter] ?? [];
}

/* ─── main component ─────────────────────────────────────────── */
function WatchContent() {
  const params = useSearchParams();
  const videoId = params.get("v") ?? "";
  const meta = videoId ? videoLookup[videoId] : null;

  const [user, setUser] = useState<User | null>(null);
  const [completed, setCompleted] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [chapterProgress, setChapterProgress] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Siblings in the same chapter
  const siblings = meta ? chapterVideos(meta.section, meta.module, meta.chapter) : [];
  const currentIdx = siblings.findIndex((v) => v.videoId === videoId);
  const prevVideo = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextVideo = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  /* auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* load completion status */
  useEffect(() => {
    if (!user || !videoId) return;
    const ref = doc(db, "video_progress", `${user.uid}_${videoId}`);
    return onSnapshot(ref, (snap) => {
      setCompleted(snap.exists() && Boolean(snap.data()?.completed));
    });
  }, [user, videoId]);

  /* load notes */
  useEffect(() => {
    if (!user || !videoId) return;
    let active = true;
    getDoc(doc(db, "video_notes", `${user.uid}_${videoId}`)).then((snap) => {
      if (active) setNotes(snap.exists() ? String(snap.data()?.text ?? "") : "");
    });
    return () => { active = false; };
  }, [user, videoId]);

  /* load chapter siblings progress */
  useEffect(() => {
    if (!user || !meta) return;
    const ids = siblings.map((v) => v.videoId).filter(Boolean) as string[];
    if (!ids.length) return;
    let active = true;
    Promise.all(
      ids.map((id) => getDoc(doc(db, "video_progress", `${user.uid}_${id}`)))
    ).then((snaps) => {
      if (!active) return;
      const next: Record<string, boolean> = {};
      snaps.forEach((snap, i) => { next[ids[i]] = snap.exists() && Boolean(snap.data()?.completed); });
      setChapterProgress(next);
    });
    return () => { active = false; };
  }, [user, meta, siblings]);

  /* mark done */
  const markDone = useCallback(async () => {
    if (!user || !videoId || markingDone) return;
    setMarkingDone(true);
    try {
      await setDoc(doc(db, "video_progress", `${user.uid}_${videoId}`), {
        userId: user.uid,
        videoId,
        completed: !completed,
        completedAt: serverTimestamp(),
        section: meta?.section ?? "",
        module: meta?.module ?? "",
        chapter: meta?.chapter ?? "",
      });
    } finally {
      setMarkingDone(false);
    }
  }, [user, videoId, markingDone, completed, meta]);

  /* auto-save notes with 1.5s debounce */
  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    setNoteSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!user || !videoId) return;
      setNoteSaving(true);
      try {
        await setDoc(doc(db, "video_notes", `${user.uid}_${videoId}`), {
          userId: user.uid,
          videoId,
          text: value,
          updatedAt: serverTimestamp(),
          section: meta?.section ?? "",
          chapter: meta?.chapter ?? "",
        });
        setNoteSaved(true);
      } finally {
        setNoteSaving(false);
      }
    }, 1500);
  }, [user, videoId, meta]);

  if (!videoId || !meta) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-[15px] font-semibold text-muted">Video not found.</p>
        <Link href="/learn" className="glass-btn-primary px-5 py-2.5 text-[13px]">Back to Learn</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          <Link href="/learn" className="hover:text-brand-darker font-medium">Learn</Link>
          <ChevronRight size={12} />
          <Link href={backHref(meta.section)} className="hover:text-brand-darker font-medium">{sectionShort(meta.section)}</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium truncate max-w-[200px]">{meta.chapter}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* ── LEFT: Player + Notes ── */}
          <div className="min-w-0">

            {/* YouTube Embed */}
            <div className="relative overflow-hidden rounded-2xl bg-black shadow-xl" style={{ aspectRatio: "16/9" }}>
              <iframe
                key={videoId}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
                title={meta.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>

            {/* Video title + Mark Done */}
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark mb-1">
                  {meta.chapter} · {meta.seq}
                </p>
                <h1 className="font-display text-[18px] font-bold leading-snug text-foreground">
                  {meta.title}
                </h1>
                <p className="mt-1 text-[12.5px] text-muted">{meta.channel} · {meta.duration}</p>
              </div>

              {/* Mark done button */}
              {user ? (
                <button
                  type="button"
                  onClick={markDone}
                  disabled={markingDone}
                  className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition-all ${
                    completed
                      ? "bg-brand text-white shadow-md shadow-brand/30"
                      : "border-2 border-brand text-brand hover:bg-brand hover:text-white"
                  }`}
                >
                  {markingDone ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : completed ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                  {completed ? "Completed" : "Mark as done"}
                </button>
              ) : (
                <Link href="/login" className="shrink-0 text-[12.5px] font-semibold text-brand-darker hover:underline">
                  Sign in to track progress
                </Link>
              )}
            </div>

            {/* Prev / Next */}
            <div className="mt-4 flex gap-3">
              {prevVideo ? (
                <Link
                  href={`/learn/watch?v=${prevVideo.videoId}`}
                  className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-[13px] font-semibold text-muted hover:border-brand hover:text-brand-darker transition"
                >
                  <ArrowLeft size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">{prevVideo.title}</span>
                </Link>
              ) : <div className="flex-1" />}
              {nextVideo && (
                <Link
                  href={`/learn/watch?v=${nextVideo.videoId}`}
                  className="flex flex-1 items-center justify-end gap-2 rounded-xl border border-brand bg-brand-tint px-4 py-3 text-[13px] font-bold text-brand-darker hover:bg-brand hover:text-white transition"
                >
                  <span className="min-w-0 truncate text-right">{nextVideo.title}</span>
                  <ChevronRight size={14} className="shrink-0" />
                </Link>
              )}
            </div>

            {/* ── Notes Section ── */}
            <div className="mt-6 rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-brand-darker" />
                  <h2 className="font-display text-[15px] font-bold text-foreground">My Notes</h2>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  {noteSaving && <Loader2 size={13} className="animate-spin text-muted" />}
                  {noteSaved && !noteSaving && (
                    <span className="flex items-center gap-1 text-brand-darker font-semibold">
                      <Save size={12} /> Saved
                    </span>
                  )}
                  {!user && <span className="text-muted">Sign in to save notes</span>}
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                disabled={!user}
                placeholder={user
                  ? "Write your notes here… key formulas, tricks, important points. Auto-saves as you type."
                  : "Sign in to take and save notes for this video."}
                rows={8}
                className="w-full resize-none rounded-xl border border-border bg-surface-muted px-4 py-3 text-[13.5px] text-foreground placeholder:text-muted/60 outline-none focus:border-brand focus:bg-white transition disabled:opacity-60"
              />
              <p className="mt-2 text-[11.5px] text-muted">
                Notes are private to you and auto-saved after you stop typing.
              </p>
            </div>
          </div>

          {/* ── RIGHT: Chapter playlist ── */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">{meta.module}</p>
                <h2 className="font-display text-[14.5px] font-bold text-foreground mt-0.5">{meta.chapter}</h2>
                <p className="text-[12px] text-muted mt-1">
                  {Object.values(chapterProgress).filter(Boolean).length} / {siblings.length} completed
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: siblings.length ? `${(Object.values(chapterProgress).filter(Boolean).length / siblings.length) * 100}%` : "0%" }}
                  />
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto thin-scroll divide-y divide-border">
                {siblings.map((v, i) => {
                  const isActive = v.videoId === videoId;
                  const isDone = v.videoId ? chapterProgress[v.videoId] : false;
                  return (
                    <Link
                      key={v.url}
                      href={v.videoId ? `/learn/watch?v=${v.videoId}` : "#"}
                      className={`flex items-start gap-3 px-4 py-3.5 transition ${
                        isActive
                          ? "bg-brand-tint border-l-2 border-brand"
                          : "hover:bg-surface-muted/60"
                      }`}
                    >
                      {/* Status icon */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-brand" />
                        ) : isActive ? (
                          <div className="flex h-4 w-4 items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                          </div>
                        ) : (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-border text-[9px] font-bold text-muted">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      {/* Title */}
                      <div className="min-w-0">
                        <p className={`text-[12.5px] leading-snug ${isActive ? "font-bold text-brand-darker" : isDone ? "text-muted line-through" : "font-medium text-foreground"}`}>
                          {v.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{v.duration || v.seq}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Back link */}
            <Link
              href={backHref(meta.section)}
              className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand-darker transition"
            >
              <ArrowLeft size={13} /> Back to {sectionShort(meta.section)}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Suspense wrapper required by Next.js App Router ── */
function WatchSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-border" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="aspect-video w-full animate-pulse rounded-2xl bg-surface-muted" />
            <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-border" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-border" />
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-border mb-4" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="mb-3 h-10 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<WatchSkeleton />}>
      <WatchContent />
    </Suspense>
  );
}
