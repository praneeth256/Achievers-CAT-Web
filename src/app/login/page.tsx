"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase/auth";
import Logo from "@/components/Logo";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";

export default function LoginPage() {
  return <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      const user = result.user;

      // Create/update the student's profile document in Firestore.
      // The Firebase security rules restrict profile writes to the signed-in user.
      const { doc, getDoc, serverTimestamp, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/client");
      const profileRef = doc(db, "profiles", user.uid);
      const existingProfile = await getDoc(profileRef);
      await setDoc(
        profileRef,
        {
          id: user.uid,
          name: user.displayName ?? "",
          email: user.email ?? "",
          avatarUrl: user.photoURL ?? "",
          lastLoginAt: serverTimestamp(),
          ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      const returnTo = searchParams.get("returnTo");
      const destination = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/daily";
      showToast("Login successful");
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <Logo className="justify-center" />
      <h1 className="mt-6 font-display text-[26px] font-bold text-foreground">
        Welcome back
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        Sign in with your Google account to attempt mocks, save your
        progress, and download scorecards.
      </p>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="mt-8 flex cursor-pointer w-full items-center justify-center gap-3 rounded-full border border-border bg-white px-5 py-3 text-[14.5px] font-semibold text-foreground shadow-sm transition hover:border-brand hover:text-brand-darker disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin text-brand" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <p className="mt-8 text-[12.5px] text-muted">
        By continuing you agree to Achievers CAT&apos;s Terms and Privacy
        Policy.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
