"use client";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { auth, authPersistenceReady, googleProvider } from "./client";

export async function signInWithGoogle(): Promise<UserCredential> {
  await authPersistenceReady;
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}
