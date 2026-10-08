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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist collapsed state across page changes
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setSidebarCollapsed(true);
  }, []);

  function toggleCollapse() {
    setSidebarCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  }

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
      <div
        className="flex min-h-screen"
        style={
          {
            "--current-sidebar-width": sidebarCollapsed ? "64px" : "var(--sidebar-width)",
          } as React.CSSProperties
        }
      >
        {/* Fixed sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* Main content area — offset by sidebar width on desktop */}
        <div
          className="sidebar-content flex flex-col"
          style={{ marginLeft: undefined }}
          data-collapsed={sidebarCollapsed ? "true" : "false"}
        >
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
