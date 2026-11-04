import { doc, getDoc } from "firebase/firestore";
import { db } from "./client";

export type Profile = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  role?: "admin" | "student";
};

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

// In-memory cache so Header and TopBar (both mounted on every page) only pay
// the Firestore read once per session rather than twice per page load.
const adminCache: Record<string, boolean> = {};

export async function isAdminUser(uid: string) {
  if (uid in adminCache) return adminCache[uid];
  const profile = await getProfile(uid);
  adminCache[uid] = profile?.role === "admin";
  return adminCache[uid];
}

/** Call this on sign-out so the cache doesn't bleed between accounts. */
export function clearAdminCache() {
  for (const key in adminCache) delete adminCache[key];
}
