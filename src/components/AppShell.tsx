"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Toast from "./Toast";
import { StudentStreakProvider } from "./StudentStreakProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Pages that get fullscreen layout (no sidebar/header)
  const isFullscreen =
    pathname.startsWith("/mock-view/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth");
  const showBackButton =
    pathname !== "/" &&
    !pathname.startsWith("/learn") &&
    !pathname.startsWith("/daily") &&
    !pathname.startsWith("/mocks") &&
    !pathname.startsWith("/mock-view/");

  if (isFullscreen) {
    return (
      <>
        <main className="flex-1">{children}</main>
        <Toast />
      </>
    );
  }

  return (
    <StudentStreakProvider>
      <div className="flex min-h-screen">
        {/* Fixed sidebar */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content area — offset by sidebar width on desktop */}
        <div className="sidebar-content flex flex-col">
          <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
          {showBackButton && (
            <div className="border-b border-border/60 bg-white/55 px-4 py-2.5 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-brand-tint hover:text-brand-darker"
              >
                <ArrowLeft size={15} /> Back
              </button>
            </div>
          )}
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <Toast />
    </StudentStreakProvider>
  );
}
