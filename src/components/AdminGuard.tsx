"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const supabase = createClient();
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState("denied");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setState(profile?.role === "admin" ? "allowed" : "denied");
    };
    void checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void checkAccess(); });
    return () => subscription.unsubscribe();
  }, []);

  if (state === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">Checking admin access…</div>;
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted">Sign in with the Google account whose Supabase profile has the <code>role: admin</code> field.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Go to login</Link>
      </div>
    );
  }

  return <>{children}</>;
}
