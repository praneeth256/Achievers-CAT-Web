"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

const StudentStreakContext = createContext(0);

export function StudentStreakProvider({ children }: { children: React.ReactNode }) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let stopStreak = () => {};
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopStreak();
      if (!user) { setStreak(0); return; }
      stopStreak = onSnapshot(doc(db, "user_streaks", user.uid), (snapshot) => {
        setStreak(Math.max(0, Number(snapshot.data()?.currentStreak || 0)));
      }, (error) => console.error("Could not load student streak:", error));
    });
    return () => { stopStreak(); stopAuth(); };
  }, []);

  return <StudentStreakContext.Provider value={streak}>{children}</StudentStreakContext.Provider>;
}

export function useStudentStreak() { return useContext(StudentStreakContext); }
