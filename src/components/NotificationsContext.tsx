"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

type NotificationItem = { id: string; text: string; createdAt?: { toMillis?: () => number } };

type NotificationsContextValue = {
  notifications: NotificationItem[];
  readNotifications: string[];
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  readNotifications: [],
  markAllRead: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

const CACHE_KEY_PREFIX = "achievers-notifications-cache-";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(uid: string): NotificationItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + uid);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: NotificationItem[]; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(uid: string, data: NotificationItem[]) {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + uid, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage unavailable � ignore
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) { setNotifications([]); setReadNotifications([]); }
  }), []);

  useEffect(() => {
    if (!user) return;
    const readKey = `achievers-read-notifications-${user.uid}`;
    const welcomeId = `welcome-${user.uid}`;
    const saved = JSON.parse(localStorage.getItem(readKey) || "[]") as string[];
    setReadNotifications(saved);

    // Use in-session cache to avoid re-fetching on every navigation
    const cached = getCached(user.uid);
    if (cached) {
      setNotifications(cached);
      return;
    }

    void getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(30))).then((snap) => {
      const items: NotificationItem[] = snap.docs.map((d) => ({
        id: d.id,
        text: String(d.data().text || ""),
        createdAt: d.data().createdAt,
      }));
      if (!localStorage.getItem(welcomeId)) {
        items.push({ id: welcomeId, text: "Welcome to Achievers CAT. Hope your journey is smooth and highly productive!" });
        localStorage.setItem(welcomeId, "true");
      }
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setNotifications(items);
      setCache(user.uid, items);
    });
  }, [user]);

  function markAllRead() {
    if (!user) return;
    const ids = notifications.map((n) => n.id);
    setReadNotifications(ids);
    localStorage.setItem(`achievers-read-notifications-${user.uid}`, JSON.stringify(ids));
  }

  return (
    <NotificationsContext.Provider value={{ notifications, readNotifications, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}
