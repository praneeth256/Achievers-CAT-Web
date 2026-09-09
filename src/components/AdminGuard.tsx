"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isAdminUser } from "@/lib/firebase/profile";
import Link from "next/link";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const checkAccess = async (user = auth.currentUser) => {
      if (!user) {
        setState("denied");
        return;
      }
      setState(await isAdminUser(user.uid) ? "allowed" : "denied");
    };
    void checkAccess();
    return onAuthStateChanged(auth, (user) => { void checkAccess(user); });
  }, []);

  if (state === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">Checking admin access…</div>;
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted">Sign in with the Google account whose Firebase profile has the <code>role: admin</code> field.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Go to login</Link>
      </div>
    );
  }

  return <>{children}</>;
}
