"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Toast from "./Toast";
import { StudentStreakProvider } from "./StudentStreakProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <Toast />
    </StudentStreakProvider>
  );
}
