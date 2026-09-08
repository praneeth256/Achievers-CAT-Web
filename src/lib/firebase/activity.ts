import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./client";

export type ActivityType = "signin" | "mock" | "practice" | "pyq" | "daily";

export function logActivity(user: User, type: ActivityType, detail: string) {
  return addDoc(collection(db, "user_activities"), {
    userId: user.uid,
    userName: user.displayName || user.email?.split("@")[0] || "Student",
    type,
    detail,
    createdAt: serverTimestamp(),
  }).catch((error) => console.error("Could not log user activity:", error));
}
