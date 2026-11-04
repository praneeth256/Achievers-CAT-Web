"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

const StudentStreakContext = createContext(0);

export function StudentStreakProvider({ children }: { children: React.ReactNode }) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    // One-shot read: the streak only changes once per day when a daily target
    // is submitted, so a permanent live listener is unnecessary. The offline
    // persistence cache in client.ts ensures this read is free on repeat visits.
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setStreak(0); return; }
      try {
        const snap = await getDoc(doc(db, "user_streaks", user.uid));
        setStreak(Math.max(0, Number(snap.data()?.currentStreak || 0)));
      } catch (error) {
        console.error("Could not load student streak:", error);
      }
    });
    return () => stopAuth();
  }, []);

  return <StudentStreakContext.Provider value={streak}>{children}</StudentStreakContext.Provider>;
}

export function useStudentStreak() { return useContext(StudentStreakContext); }
