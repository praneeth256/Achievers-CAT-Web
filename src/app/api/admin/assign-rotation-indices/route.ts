/**
 * One-time admin route to assign emailRotationIndex to all profiles.
 * POST /api/admin/assign-rotation-indices
 *
 * Protected: requires the same CRON_SECRET in the Authorization header.
 * Idempotent: students who already have an index keep it. Only assigns
 * indices to profiles that don't have one yet.
 *
 * Ordering: profiles are sorted alphabetically by displayName/name/email
 * so the assignment is stable and predictable.
 */

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snap = await db.collection("profiles").get();

    // Sort all profiles by display name for a stable, predictable ordering.
    const allProfiles = snap.docs
      .map((d) => ({
        ref: d.ref,
        label:
          (d.data().displayName || d.data().name || d.data().email || d.id) as string,
        existingIndex: d.data().emailRotationIndex as number | undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Find profiles that already have an index; keep a set to avoid conflicts.
    const usedIndices = new Set(
      allProfiles
        .filter((p) => typeof p.existingIndex === "number")
        .map((p) => p.existingIndex as number)
    );

    // Assign the next available index to profiles that don't have one.
    let nextIndex = 0;
    const updates: { ref: FirebaseFirestore.DocumentReference; index: number }[] = [];

    for (const profile of allProfiles) {
      if (typeof profile.existingIndex !== "number") {
        // Skip over already-used indices to avoid duplicates.
        while (usedIndices.has(nextIndex)) nextIndex++;
        updates.push({ ref: profile.ref, index: nextIndex });
        usedIndices.add(nextIndex);
        nextIndex++;
      }
    }

    // Commit in batches of 500 (Firestore limit).
    let i = 0;
    while (i < updates.length) {
      const batch: WriteBatch = db.batch();
      const slice = updates.slice(i, i + 500);
      slice.forEach(({ ref, index }) => {
        batch.update(ref, { emailRotationIndex: index });
      });
      await batch.commit();
      i += 500;
    }

    return NextResponse.json({
      ok: true,
      total: allProfiles.length,
      assigned: updates.length,
      alreadyIndexed: allProfiles.length - updates.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("assign-rotation-indices error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
