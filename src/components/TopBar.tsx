"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Flame,
  Bell,
  ChevronDown,
  UserRound,
  LogOut,
  BarChart3,
  ShieldCheck,
  CheckCheck,
  Menu,
} from "lucide-react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { isAdminUser } from "@/lib/firebase/profile";
import { signOutUser } from "@/lib/firebase/auth";
import { useStudentStreak } from "./StudentStreakProvider";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const streak = useStudentStreak();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string; createdAt?: { toMillis?: () => number } }[]>([]);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = async (nextUser: User | null) => {
      setUser(nextUser);
      if (nextUser) setIsAdmin(await isAdminUser(nextUser.uid));
      else setIsAdmin(false);
    };
    void loadUser(auth.currentUser);
    return onAuthStateChanged(auth, (u) => { void loadUser(u); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const readKey = `achievers-read-notifications-${user.uid}`;
    const welcomeId = `welcome-${user.uid}`;
    const saved = JSON.parse(localStorage.getItem(readKey) || "[]") as string[];
    void getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(30))).then((snap) => {
      setReadNotifications(saved);
      const items: { id: string; text: string; createdAt?: { toMillis: () => number } }[] = snap.docs.map((d) => ({ id: d.id, text: String(d.data().text || ""), createdAt: d.data().createdAt }));
      if (!localStorage.getItem(welcomeId)) {
        items.push({ id: welcomeId, text: "Welcome to Achievers CAT. Hope your journey is smooth and highly productive!" });
        localStorage.setItem(welcomeId, "true");
      }
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setNotifications(items);
    });
  }, [user]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function markAllRead() {
    if (!user) return;
    const ids = notifications.map((n) => n.id);
    setReadNotifications(ids);
    localStorage.setItem(`achievers-read-notifications-${user.uid}`, JSON.stringify(ids));
  }

  async function logout() {
    await signOutUser();
    setAccountOpen(false);
    window.location.href = "/";
  }

  const unread = notifications.some((n) => !readNotifications.includes(n.id));

  return (
    <header className="top-header">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-foreground hover:bg-brand-tint hover:text-brand-darker lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Search bar */}
      <div className="search-bar" role="search">
        <Search size={15} className="shrink-0 text-muted" />
        <input
          type="search"
          placeholder="Search for topics, mocks, videos, questions..."
          aria-label="Search Achievers CAT"
        />
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Streak */}
        {user && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1.5 text-[13px] font-bold text-orange-600" title="Daily streak">
            <Flame size={14} className="text-flame" />
            <span>{streak}</span>
            <span className="hidden sm:inline text-[11px] font-medium text-orange-500">Day Streak</span>
          </div>
        )}

        {/* Notifications */}
        {user && (
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-foreground hover:border-brand hover:bg-brand-tint"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-white" />}
            </button>

            {notificationsOpen && (
              <div className="glass-panel absolute right-0 top-full mt-2 w-80 rounded-2xl p-3 z-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm font-semibold">Notifications</p>
                  <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-darker">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                </div>
                {notifications.length ? (
                  <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto thin-scroll">
                    {notifications.map((n) => (
                      <div key={n.id} className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${readNotifications.includes(n.id) ? "bg-surface-muted text-muted" : "bg-brand-tint text-foreground"}`}>
                        {n.text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted">No new notifications.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Account */}
        {!user ? (
          <Link href="/login" className="glass-btn-primary px-4 py-2 text-[13px]">Log in</Link>
        ) : (
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pl-1 pr-3 hover:border-brand hover:bg-brand-tint"
              aria-label="Account menu"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-darker">
                  <UserRound size={15} />
                </span>
              )}
              <span className="hidden sm:block max-w-[110px] truncate text-[13px] font-semibold text-foreground">
                {(user.displayName || "Account").split(" ")[0]}
              </span>
              <ChevronDown size={13} className={`text-muted transition-transform ${accountOpen ? "rotate-180" : ""}`} />
            </button>

            {accountOpen && (
              <div className="glass-panel absolute right-0 top-full mt-2 w-60 rounded-2xl p-1.5 z-50">
                <div className="border-b border-border/50 px-3.5 py-3">
                  <p className="truncate text-[14px] font-semibold text-foreground">{user.displayName || "Student"}</p>
                  <p className="truncate text-[12px] text-muted">{user.email}</p>
                </div>
                <Link href="/performance" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-foreground hover:bg-brand-tint hover:text-brand-darker">
                  <BarChart3 size={15} /> My Performance
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-foreground hover:bg-brand-tint hover:text-brand-darker">
                    <ShieldCheck size={15} /> Admin Dashboard
                  </Link>
                )}
                <div className="mt-1 border-t border-border/50 pt-1">
                  <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] text-danger hover:bg-red-50">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
