"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Footer from "./Footer";
import Header from "./Header";
import Toast from "./Toast";
import { StudentStreakProvider } from "./StudentStreakProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMockTab = pathname.startsWith("/mock-view/") || (pathname.includes("/mocks/") && pathname.endsWith("/take"));
  const showBack = pathname !== "/" && !isMockTab;

  useEffect(() => {
    const scrollCurrentPageToTop = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const target = new URL(anchor.href, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname !== window.location.pathname || target.search !== window.location.search) return;
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.addEventListener("click", scrollCurrentPageToTop, true);
    return () => document.removeEventListener("click", scrollCurrentPageToTop, true);
  }, []);

  if (isMockTab) return <><main className="flex-1">{children}</main><Toast /></>;

  return <StudentStreakProvider>
    <Header />
    <main className="flex-1">{showBack && <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8"><button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand-darker"><ArrowLeft size={16} /> Back</button></div>}{children}</main>
    <Footer />
    <Toast />
  </StudentStreakProvider>;
}
