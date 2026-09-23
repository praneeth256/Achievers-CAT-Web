"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Mail, RefreshCw, Users, CheckCircle, XCircle, BarChart2, Send, Loader2, Info } from "lucide-react";
import { showToast } from "@/components/Toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type EmailLog = {
  date: string;
  totalStudents: number;
  windowStart: number;
  windowSize: number;
  skippedCompleted: number;
  skippedOptOut: number;
  sentCount: number;
  failedCount: number;
  sentAt?: { toDate?: () => Date };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIST() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

function fmtDate(value?: { toDate?: () => Date } | null) {
  const d = value?.toDate?.();
  if (!d) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// ─── Inner Component ─────────────────────────────────────────────────────────

function EmailDashboard() {
  const [log, setLog] = useState<EmailLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [cronSecret, setCronSecret] = useState("");
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  // Load today's log and recent history
  useEffect(() => {
    async function load() {
      try {
        const today = todayIST();
        const [todaySnap, historySnap, profileCountSnap] = await Promise.all([
          getDoc(doc(db, "email_logs", today)),
          getDocs(query(collection(db, "email_logs"), orderBy("date", "desc"), limit(7))),
          getDocs(query(collection(db, "profiles"), limit(1))),
        ]);

        if (todaySnap.exists()) setLog(todaySnap.data() as EmailLog);
        setRecentLogs(historySnap.docs.map((d) => d.data() as EmailLog));

        // Get a rough count of profiles
        const countSnap = await getDocs(collection(db, "profiles"));
        setTotalStudents(countSnap.size);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function triggerNow() {
    if (!cronSecret.trim()) {
      showToast("Enter the CRON_SECRET first.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/cron/daily-email", {
        headers: { Authorization: `Bearer ${cronSecret.trim()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      showToast(`✅ Sent ${json.sent} emails (${json.skippedCompleted} already done, ${json.failed} failed).`);
      // Refresh log
      const today = todayIST();
      const snap = await getDoc(doc(db, "email_logs", today));
      if (snap.exists()) setLog(snap.data() as EmailLog);
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  }

  async function assignIndices() {
    if (!cronSecret.trim()) {
      showToast("Enter the CRON_SECRET first.");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/assign-rotation-indices", {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret.trim()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      showToast(`✅ Assigned indices to ${json.assigned} students (${json.alreadyIndexed} already had one).`);
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setAssigning(false);
    }
  }

  // ── Window preview ─────────────────────────────────────────────────────────
  const WINDOW = 500;
  const total = totalStudents ?? 0;
  const nowMs = Date.now();
  const dayOffset = Math.floor(nowMs / 86_400_000);
  const windowStart = total > 0 ? (dayOffset * WINDOW) % total : 0;
  const windowEnd = total > 0 ? (windowStart + Math.min(WINDOW, total) - 1) % total : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Admin</p>
      <h1 className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold">
        <Mail className="text-brand" /> Email Reminders
      </h1>
      <p className="mt-2 text-sm text-muted">
        Daily reminders sent via Gmail API with fair rotation across all students.
        Max 500 emails/day — only students who haven't completed today's target receive one.
      </p>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="Total students" value={total || "—"} />
          <StatCard icon={BarChart2} label="Today's window" value={total > 0 ? `${Math.min(WINDOW, total)}` : "—"} sub={`indices ${windowStart}–${windowEnd}`} />
          <StatCard icon={CheckCircle} label="Sent today" value={log?.sentCount ?? "—"} colour="text-emerald-600" />
          <StatCard icon={XCircle} label="Skipped (done)" value={log?.skippedCompleted ?? "—"} colour="text-amber-500" />
        </div>
      )}

      {/* ── Today's log summary ───────────────────────────────────────────── */}
      {log && (
        <div className="mt-6 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">Today's send — {log.date}</p>
          <p className="mt-1 text-xs text-muted">Sent at {fmtDate(log.sentAt)}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-emerald-700"><strong>{log.sentCount}</strong> sent</span>
            <span className="text-amber-600"><strong>{log.skippedCompleted}</strong> already completed</span>
            <span className="text-muted"><strong>{log.skippedOptOut}</strong> opted out</span>
            {log.failedCount > 0 && <span className="text-red-600"><strong>{log.failedCount}</strong> failed</span>}
          </div>
        </div>
      )}

      {/* ── Manual trigger ────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">Manual trigger / One-time setup</p>
        <p className="mt-1 text-xs text-muted">
          Enter your CRON_SECRET (set in Vercel env vars) to authenticate these actions.
        </p>
        <input
          type="password"
          placeholder="CRON_SECRET"
          value={cronSecret}
          onChange={(e) => setCronSecret(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={triggerNow}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send today's emails now
          </button>
          <button
            onClick={assignIndices}
            disabled={assigning}
            className="inline-flex items-center gap-2 rounded-full border border-brand px-5 py-2.5 text-sm font-semibold text-brand disabled:opacity-50"
          >
            {assigning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Assign rotation indices
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-tint p-3 text-xs text-brand-darker">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Run <strong>Assign rotation indices</strong> once after setup (or when new students join without an index).
            It's idempotent — existing indices are preserved.
          </span>
        </div>
      </div>

      {/* ── 7-day history ─────────────────────────────────────────────────── */}
      {recentLogs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold">Recent send history</p>
          </div>
          <div className="divide-y divide-border">
            {recentLogs.map((row) => (
              <div key={row.date} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-medium text-foreground">{row.date}</span>
                <div className="flex gap-4 text-xs text-muted">
                  <span className="text-emerald-700 font-semibold">{row.sentCount} sent</span>
                  <span>{row.skippedCompleted} done</span>
                  {row.failedCount > 0 && <span className="text-red-600">{row.failedCount} failed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rotation info ─────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">How the rotation works</p>
        <div className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
          <p>Every student has a permanent <strong>emailRotationIndex</strong> (0, 1, 2 … N).</p>
          <p>Each day, the system selects 500 students starting at <code className="text-xs bg-gray-100 px-1 rounded">windowStart = (dayNumber × 500) % totalStudents</code>.</p>
          <p>The selection wraps around so every student gets covered. With {total || "N"} students the cycle repeats every <strong>{total > 0 ? Math.round((total / gcd(total, WINDOW)) * (WINDOW / gcd(total, WINDOW))) : "?"} days</strong>.</p>
          <p>Students who already completed today's Quant + VARC + DILR are skipped automatically.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  colour = "text-brand",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  colour?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <Icon size={16} className="text-muted" />
      <p className={`mt-2 font-display text-[22px] font-bold ${colour}`}>{value}</p>
      <p className="text-[12px] text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted/70">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminEmailPage() {
  return <AdminGuard><EmailDashboard /></AdminGuard>;
}
