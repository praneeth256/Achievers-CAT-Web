"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  ChevronDown,
  Flame,
  UserRound,
  LogOut,
  BarChart3,
  ShieldCheck,
  Bell,
  CheckCheck,
} from "lucide-react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import Logo from "./Logo";
import { auth, db } from "@/lib/firebase/client";
import { isAdminUser } from "@/lib/firebase/profile";
import { signOutUser } from "@/lib/firebase/auth";
import { useStudentStreak } from "./StudentStreakProvider";

const nav = [
  { label: "Home", href: "/" },
  {
    label: "Daily Targets",
    href: "/daily",
    free: true,
    children: [
      { label: "Quantitative Aptitude", href: "/daily/question?section=quant" },
      { label: "RC of the Day", href: "/daily/question?section=varc" },
      { label: "DILR Set of the Day", href: "/daily/question?section=dilr" },
    ],
  },
  {
    label: "Learn",
    href: "/learn",
    free: true,
    children: [
      { label: "DILR — Aptitude Jab (412 sets)", href: "/learn?subject=dilr" },
      { label: "Quant (Coming Soon)", href: "/learn?subject=quant" },
      { label: "VARC (Coming Soon)", href: "/learn?subject=varc" },
    ],
  },
  {
    label: "Practice",
    href: "/practice",
    free: true,
    children: [
      { label: "Topic-wise Questions", href: "/practice" },
      { label: "Topic-wise PYQs", href: "/practice/pyqs" },
    ],
  },
  {
    label: "Sectional Mocks",
    href: "/sectional",
    free: true,
    children: [
      { label: "VARC", href: "/sectional/varc" },
      { label: "DILR", href: "/sectional/dilr" },
      { label: "QA", href: "/sectional/qa" },
    ],
  },
  { label: "Full Mocks", href: "/mocks", free: true },
  { label: "Materials", href: "/materials", free: true },
  { label: "My Performance", href: "/performance" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const streak = useStudentStreak();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string; createdAt?: { toMillis?: () => number } }[]>([]);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = async (nextUser: User | null) => {
      setUser(nextUser);
      if (nextUser) {
        setIsAdmin(await isAdminUser(nextUser.uid));
      } else {
        setIsAdmin(false);
      }
    };
    void loadUser(auth.currentUser);
    return onAuthStateChanged(auth, (nextUser) => { void loadUser(nextUser); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const readKey = `achievers-read-notifications-${user.uid}`;
    const welcomeId = `welcome-${user.uid}`;
    const saved = JSON.parse(localStorage.getItem(readKey) || "[]") as string[];
    void getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(30))).then((snapshot) => {
      setReadNotifications(saved);
      const items: { id: string; text: string; createdAt?: { toMillis: () => number } }[] = snapshot.docs.map((item) => ({ id: item.id, text: String(item.data().text || ""), createdAt: item.data().createdAt }));
      if (!localStorage.getItem(welcomeId)) {
        items.push({ id: welcomeId, text: "Welcome to Achievers CAT. Hope your journey is smooth and highly productive!" });
        localStorage.setItem(welcomeId, "true");
      }
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setNotifications(items);
    });
  }, [user]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function markAllNotificationsRead() {
    if (!user) return;
    const ids = notifications.map((n) => n.id);
    setReadNotifications(ids);
    localStorage.setItem(`achievers-read-notifications-${user.uid}`, JSON.stringify(ids));
  }

  async function logout() {
    await signOutUser();
    setAccountOpen(false);
    setOpen(false);
    window.location.href = "/";
  }

  const unread = notifications.some((n) => !readNotifications.includes(n.id));

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1 sm:px-6">
      <div className="glass-nav mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-5">

        {/* LOGO */}
        <Link href="/" onClick={() => setOpen(false)} className="shrink-0">
          <Logo />
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {nav.map((item) =>
            item.children ? (
              <div key={item.label} className="group relative">
                {item.label === "Practice" || item.label === "Learn" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.label === "Practice") setPracticeOpen((v) => !v);
                      if (item.label === "Learn") setLearnOpen((v) => !v);
                    }}
                    aria-expanded={item.label === "Practice" ? practiceOpen : learnOpen}
                    className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-foreground/75 hover:bg-brand-tint hover:text-brand-darker"
                  >
                    {item.free && <span className="absolute -right-0.5 -top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm shadow-brand/40">FREE</span>}
                    {item.label}
                    <ChevronDown size={12} className={`text-muted transition-transform duration-200 ${(item.label === "Practice" ? practiceOpen : learnOpen) ? "rotate-180" : ""}`} />
                  </button>
                ) : (
                  <Link href={item.href} className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-foreground/75 hover:bg-brand-tint hover:text-brand-darker">
                    {item.free && <span className="absolute -right-0.5 -top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm shadow-brand/40">FREE</span>}
                    {item.label}
                    <ChevronDown size={12} className="text-muted transition-transform duration-200 group-hover:rotate-180" />
                  </Link>
                )}

                {/* Dropdown */}
                <div className={`${
                  item.label === "Practice"
                    ? (practiceOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0")
                    : item.label === "Learn"
                    ? (learnOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0")
                    : "invisible -translate-y-1 opacity-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
                } absolute left-0 top-full pt-2 transition-all duration-150`}>
                  <div className="glass-panel min-w-[230px] rounded-2xl p-1.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => { setPracticeOpen(false); setLearnOpen(false); }}
                        className="block rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-foreground/80 hover:bg-brand-tint hover:text-brand-darker"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-xl px-3 py-1.5 text-[13px] font-medium text-foreground/75 hover:bg-brand-tint hover:text-brand-darker"
              >
                {item.free && <span className="absolute -right-0.5 -top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm shadow-brand/40">FREE</span>}
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* DESKTOP ACCOUNT */}
        <div className="hidden items-center gap-2.5 lg:flex">

          {/* Streak chip */}
          {user && (
            <div className="flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[13px] font-semibold text-brand-darker" title="Your current daily practice streak">
              <Flame size={14} className="text-flame" />
              {streak}
            </div>
          )}

          {!user ? (
            <Link href="/login" className="glass-btn-primary px-4 py-2 text-[13px]">
              Log in
            </Link>
          ) : (
            <>
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/70 text-foreground hover:border-brand hover:bg-brand-tint"
                  aria-label="Open notifications"
                >
                  <Bell size={16} />
                  {unread && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-white" />}
                </button>
                {notificationsOpen && (
                  <div className="glass-panel absolute right-0 top-full mt-2 w-80 rounded-2xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-sm font-semibold">Notifications</p>
                      <button onClick={markAllNotificationsRead} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-darker">
                        <CheckCheck size={13} />Mark all read
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

              {/* Account dropdown */}
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-border bg-white/70 py-1 pl-1 pr-3 hover:border-brand hover:bg-brand-tint"
                  aria-label="Open account menu"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-darker">
                      <UserRound size={15} />
                    </span>
                  )}
                  <span className="max-w-[110px] truncate text-[13px] font-semibold text-foreground">
                    {(user.displayName || "Account").split(" ")[0]}
                  </span>
                  <ChevronDown size={13} className={`text-muted transition-transform duration-200 ${accountOpen ? "rotate-180" : ""}`} />
                </button>

                {accountOpen && (
                  <div className="glass-panel absolute right-0 top-full mt-2 w-60 rounded-2xl p-1.5">
                    <div className="border-b border-border/50 px-3.5 py-3">
                      <p className="truncate text-[14px] font-semibold text-foreground">{user.displayName || "Student"}</p>
                      <p className="truncate text-[12px] text-muted">{user.email}</p>
                    </div>

                    <Link href="/performance" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-foreground hover:bg-brand-tint hover:text-brand-darker">
                      <BarChart3 size={15} />My Performance
                    </Link>
                    <Link href="/profile" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-foreground hover:bg-brand-tint hover:text-brand-darker">
                      <UserRound size={15} />Profile
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-foreground hover:bg-brand-tint hover:text-brand-darker">
                        <ShieldCheck size={15} />Admin Dashboard
                      </Link>
                    )}
                    <div className="mt-1 border-t border-border/50 pt-1">
                      <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] text-danger hover:bg-red-50">
                        <LogOut size={15} />Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/60 bg-white/50 text-foreground backdrop-blur hover:bg-brand-tint hover:border-brand lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* MOBILE NAVIGATION */}
      {open && (
        <div className="mx-4 mb-2 overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-xl shadow-black/[0.06] backdrop-blur-2xl lg:hidden">
          <nav className="space-y-0.5 px-3 py-3">

            {nav.map((item) => (
              <div key={item.label} className="py-0.5">
                {item.label === "Practice" || item.label === "Learn" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.label === "Practice") setPracticeOpen((v) => !v);
                      if (item.label === "Learn") setLearnOpen((v) => !v);
                    }}
                    aria-expanded={item.label === "Practice" ? practiceOpen : learnOpen}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-brand-tint"
                  >
                    {item.label}
                    {item.free && <span className="animate-pulse rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-brand-darker">Free</span>}
                  </button>
                ) : (
                  <Link href={item.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-brand-tint">
                    {item.label}
                    {item.free && <span className="animate-pulse rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-brand-darker">Free</span>}
                  </Link>
                )}

                {item.children && (
                  (item.label === "Practice" ? practiceOpen : item.label === "Learn" ? learnOpen : true)
                ) && (
                  <div className="ml-3 mt-0.5 flex flex-col border-l-2 border-brand-tint pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => { setOpen(false); setPracticeOpen(false); setLearnOpen(false); }}
                        className="rounded-xl px-3 py-2 text-[14px] font-medium text-muted hover:bg-brand-tint hover:text-brand-darker"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* MOBILE ACCOUNT */}
            <div className="mt-2 border-t border-border/50 pt-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-darker"><UserRound size={15} /></span>
                    )}
                    <div>
                      <p className="text-[13.5px] font-semibold text-foreground">{user.displayName || "Student"}</p>
                      <p className="text-[12px] text-muted">{user.email}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[12.5px] font-semibold text-brand-darker">
                      <Flame size={13} className="text-flame" />{streak}
                    </div>
                  </div>

                  <Link href="/performance" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-foreground hover:bg-brand-tint">
                    <BarChart3 size={15} />My Performance
                  </Link>
                  <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-foreground hover:bg-brand-tint">
                    <UserRound size={15} />Profile
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-medium text-foreground hover:bg-brand-tint">
                      <ShieldCheck size={15} />Admin Dashboard
                    </Link>
                  )}
                  <button type="button" onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-xl border border-red-100 px-3 py-2.5 text-left text-[14.5px] font-semibold text-danger hover:bg-red-50">
                    <LogOut size={15} />Logout
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="glass-btn-primary block px-4 py-2.5 text-center text-[14px]">
                  Log in
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
