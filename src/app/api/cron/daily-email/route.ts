/**
 * Daily email cron handler — GET /api/cron/daily-email
 *
 * Invoked by Vercel Cron at 7:00 AM IST (01:30 UTC) every day.
 * Can also be triggered manually from the admin UI.
 *
 * Algorithm
 * ─────────
 * 1. Authenticate via CRON_SECRET header.
 * 2. Fetch all profiles from Firestore (emailRotationIndex, email, displayName, dailyEmailEnabled).
 * 3. Sort profiles by emailRotationIndex (ascending).
 * 4. Compute today's 500-student window using a deterministic day offset —
 *    no persistent state required:
 *      dayOffset   = Math.floor(Date.now() / 86_400_000)
 *      windowStart = (dayOffset * WINDOW_SIZE) % totalStudents
 *    This gives every student coverage in ⌈totalStudents / WINDOW_SIZE⌉-day cycles.
 * 5. Fetch today's daily_attempts for the selected UIDs.
 *    A student has "completed today" if they have attempts for all 3 sections
 *    (quant, varc, dilr) for today's date.
 * 6. Send emails only to students who haven't completed today's target and
 *    have dailyEmailEnabled !== false.
 * 7. Write an email_log document to Firestore for auditing.
 */

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendEmail, buildDailyReminderEmail } from "@/lib/gmail";

// ─── Constants ───────────────────────────────────────────────────────────────

const WINDOW_SIZE = 500; // max emails per day (Gmail API free limit)
const SECTIONS = ["quant", "varc", "dilr"] as const;
const SEND_DELAY_MS = 200; // delay between sends to avoid Gmail rate limits

// ─── Firebase Admin (lazy singleton) ─────────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // The private key is stored with literal \n in env vars; parse them back.
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** ISO date string in IST (UTC+05:30) for a given timestamp. */
function todayIST(nowMs = Date.now()): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(nowMs + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Sleep for `ms` milliseconds. */
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5-minute Vercel function timeout

export async function GET(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowMs = Date.now();
  const date = todayIST(nowMs);

  try {
    const db = getFirestore(getAdminApp());

    // ── 2. Fetch all profiles ────────────────────────────────────────────────
    const profilesSnap = await db.collection("profiles").get();
    const allProfiles = profilesSnap.docs.map((d) => ({
      uid: d.id,
      email: d.data().email as string | undefined,
      displayName: (d.data().displayName || d.data().name || "Student") as string,
      emailRotationIndex: (d.data().emailRotationIndex ?? null) as number | null,
      dailyEmailEnabled: d.data().dailyEmailEnabled !== false,
    }));

    // ── 3. Sort by rotation index; put unindexed profiles at the end ─────────
    // Profiles without an emailRotationIndex are treated as if they sit at the
    // back of the queue. They'll be emailed whenever the window reaches them.
    const indexed = allProfiles.filter((p) => p.emailRotationIndex !== null).sort(
      (a, b) => (a.emailRotationIndex as number) - (b.emailRotationIndex as number)
    );
    const unindexed = allProfiles.filter((p) => p.emailRotationIndex === null);
    const sorted = [...indexed, ...unindexed];

    const totalStudents = sorted.length;
    if (totalStudents === 0) {
      return NextResponse.json({ message: "No profiles found.", date });
    }

    // ── 4. Compute today's window ────────────────────────────────────────────
    // dayOffset is deterministic from the Unix timestamp — no Firestore read needed.
    const dayOffset = Math.floor(nowMs / 86_400_000);
    const windowStart = (dayOffset * WINDOW_SIZE) % totalStudents;
    const windowSize = Math.min(WINDOW_SIZE, totalStudents);

    // Build the window, wrapping around the sorted array.
    const windowProfiles: typeof sorted = [];
    for (let i = 0; i < windowSize; i++) {
      windowProfiles.push(sorted[(windowStart + i) % totalStudents]);
    }

    // ── 5. Filter: opt-in only, has a valid email ────────────────────────────
    const eligible = windowProfiles.filter(
      (p) => p.dailyEmailEnabled && p.email && p.email.includes("@")
    );

    // ── 6. Check daily_attempts — who already completed today? ───────────────
    // daily_attempts document IDs: "{date}_{section}_{uid}"
    // We query per-section for the UIDs in our window.
    const eligibleUids = new Set(eligible.map((p) => p.uid));
    const completedSections: Record<string, Set<string>> = {
      quant: new Set(),
      varc: new Set(),
      dilr: new Set(),
    };

    await Promise.all(
      SECTIONS.map(async (section) => {
        // Firestore "in" operator supports up to 30 values; batch if needed.
        const uidBatches: string[][] = [];
        const uidArray = [...eligibleUids];
        for (let i = 0; i < uidArray.length; i += 30) {
          uidBatches.push(uidArray.slice(i, i + 30));
        }
        await Promise.all(
          uidBatches.map(async (batch) => {
            const snap = await db
              .collection("daily_attempts")
              .where("date", "==", date)
              .where("section", "==", section)
              .where("userId", "in", batch)
              .select("userId")
              .get();
            snap.docs.forEach((d) =>
              completedSections[section].add(d.data().userId as string)
            );
          })
        );
      })
    );

    // A student has completed today if they have attempts in ALL 3 sections.
    const completedToday = new Set(
      [...eligibleUids].filter(
        (uid) =>
          completedSections.quant.has(uid) &&
          completedSections.varc.has(uid) &&
          completedSections.dilr.has(uid)
      )
    );

    // ── 7. Send emails ───────────────────────────────────────────────────────
    const toSend = eligible.filter((p) => !completedToday.has(p.uid));

    let sentCount = 0;
    let failedCount = 0;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://achievers-cat-web.vercel.app";

    for (const profile of toSend) {
      try {
        await sendEmail({
          to: profile.email!,
          subject: `🎯 Your ACHIEVERS CAT Daily Target — ${date}`,
          htmlBody: buildDailyReminderEmail({
            displayName: profile.displayName,
            date,
            appUrl,
          }),
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send email to ${profile.email}:`, err);
        failedCount++;
      }
      // Small delay to stay within Gmail API rate limits (250 quota units/s).
      await sleep(SEND_DELAY_MS);
    }

    // ── 8. Write audit log ───────────────────────────────────────────────────
    await db.collection("email_logs").doc(date).set(
      {
        date,
        totalStudents,
        windowStart,
        windowSize: eligible.length,
        skippedCompleted: eligible.length - toSend.length,
        skippedOptOut: windowProfiles.length - eligible.length,
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      date,
      totalStudents,
      windowStart,
      eligible: eligible.length,
      skippedCompleted: eligible.length - toSend.length,
      sent: sentCount,
      failed: failedCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("daily-email cron error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
