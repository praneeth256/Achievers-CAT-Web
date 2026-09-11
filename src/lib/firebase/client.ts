import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
// Persist Firebase's refresh token in the browser, so a user remains signed
// in after navigation, closing/reopening tabs, and browser restarts. The only
// exceptions are deliberate logout, clearing this site's data, or private
// browsing mode (where browsers intentionally discard local storage).
export const authPersistenceReady = typeof window === "undefined"
  ? Promise.resolve()
  : setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("Could not enable persistent sign-in.", error);
    });
// Keep previously read Firestore documents in the browser's IndexedDB cache.
// This preserves every feature (including live listeners) while avoiding a
// complete set of repeat reads when a student returns, refreshes, or opens a
// second tab. Server rendering has no IndexedDB, so it retains the standard
// in-memory client there.
export const db = typeof window === "undefined"
  ? getFirestore(firebaseApp)
  : initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });
