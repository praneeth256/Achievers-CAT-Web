"use client";

import {
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { auth, authPersistenceReady, googleProvider } from "./client";

export async function signInWithGoogle(): Promise<UserCredential> {
  await authPersistenceReady;
  await setPersistence(auth, browserLocalPersistence);
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    // Browsers that block popups (e.g. some mobile browsers, aggressive
    // ad-blockers, or strict privacy settings) throw auth/popup-blocked.
    // Fall back to redirect flow so the user can still sign in.
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
      await signInWithRedirect(auth, googleProvider);
      // signInWithRedirect navigates away; this line is never reached.
      // The result is captured in getGoogleRedirectResult() on page load.
      return Promise.reject(err);
    }
    throw err;
  }
}

/**
 * Call this on the login page mount to capture the result after a redirect
 * sign-in completes. Returns null if no pending redirect result.
 */
export async function getGoogleRedirectResult(): Promise<UserCredential | null> {
  await authPersistenceReady;
  await setPersistence(auth, browserLocalPersistence);
  return getRedirectResult(auth);
}

export function signOutUser() {
  return signOut(auth);
}
