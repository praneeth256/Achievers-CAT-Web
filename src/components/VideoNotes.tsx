"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Cloud, Loader2, StickyNote } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type SaveState = "loading" | "saving" | "saved" | "retrying" | "signin";

export default function VideoNotes({ userId, videoId }: { userId: string | null; videoId: string }) {
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<SaveState>(userId ? "loading" : "signin");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const noteRef = useRef("");
  const savedNoteRef = useRef("");
  const savingRef = useRef(false);

  useEffect(() => { noteRef.current = note; }, [note]);

  useEffect(() => {
    const session = ++sessionRef.current;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    savingRef.current = false;
    noteRef.current = "";
    savedNoteRef.current = "";
    setNote("");

    if (!userId) {
      setSaveState("signin");
      return;
    }

    setSaveState("loading");
    void getDoc(doc(db, "users", userId, "videoNotes", videoId))
      .then((snapshot) => {
        if (session !== sessionRef.current) return;
        const loadedNote = typeof snapshot.data()?.text === "string" ? snapshot.data()!.text : "";
        noteRef.current = loadedNote;
        savedNoteRef.current = loadedNote;
        setNote(loadedNote);
        setSaveState("saved");
      })
      .catch(() => {
        if (session === sessionRef.current) setSaveState("retrying");
      });

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [userId, videoId]);

  function scheduleSave(delay = 1500) {
    if (!userId || saveState === "loading" || noteRef.current === savedNoteRef.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const session = sessionRef.current;
    const noteToSave = noteRef.current;
    debounceTimer.current = setTimeout(() => {
      if (session !== sessionRef.current || !userId || noteToSave === savedNoteRef.current || savingRef.current) return;
      savingRef.current = true;
      setSaveState("saving");
      void setDoc(doc(db, "users", userId, "videoNotes", videoId), { text: noteToSave, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => {
          if (session !== sessionRef.current) return;
          savedNoteRef.current = noteToSave;
          if (noteRef.current === noteToSave) setSaveState("saved");
          else scheduleSave();
        })
        .catch(() => {
          if (session !== sessionRef.current) return;
          setSaveState("retrying");
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => scheduleSave(), 2000);
        })
        .finally(() => { savingRef.current = false; });
    }, delay);
  }

  function handleChange(value: string) {
    noteRef.current = value;
    setNote(value);
    if (!userId || saveState === "loading") return;
    if (value === savedNoteRef.current) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setSaveState("saved");
      return;
    }
    scheduleSave();
  }

  const status = {
    loading: <><Loader2 size={13} className="animate-spin" /> Loading notes…</>,
    saving: <><Cloud size={13} /> Saving…</>,
    saved: <><Check size={13} /> Saved</>,
    retrying: <>Couldn&apos;t save. Retrying…</>,
    signin: <>Sign in to save private notes</>,
  }[saveState];

  return (
    <section className="rounded-2xl border border-border bg-surface-muted/60 p-3.5 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint text-brand-dark"><StickyNote size={15} /></span><div><h3 className="text-[13px] font-bold text-foreground">My Notes</h3><p className="text-[10.5px] text-muted">Private to you for this video</p></div></div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${saveState === "retrying" ? "text-danger" : "text-muted"}`}>{status}</span>
      </div>
      <textarea value={note} onChange={(event) => handleChange(event.target.value)} disabled={!userId || saveState === "loading"} placeholder={userId ? "Write key ideas, shortcuts, or doubts…" : "Sign in to keep notes for this video."} className="min-h-28 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none transition placeholder:text-muted/70 focus:border-brand/50 focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-surface-muted" />
    </section>
  );
}
