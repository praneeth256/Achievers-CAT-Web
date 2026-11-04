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
import {
  firestoreGetCollection,
  firestoreBatchWrite,
  type BatchWrite,
} from "@/lib/firebase/admin-rest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const docs = await firestoreGetCollection("profiles");

    // Sort all profiles by display name for a stable, predictable ordering.
    const allProfiles = docs
      .map((d) => ({
        id: d.id,
        label: ((d.data.displayName || d.data.name || d.data.email || d.id) as string),
        existingIndex: d.data.emailRotationIndex as number | undefined,
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
    const updates: BatchWrite[] = [];

    for (const profile of allProfiles) {
      if (typeof profile.existingIndex !== "number") {
        // Skip over already-used indices to avoid duplicates.
        while (usedIndices.has(nextIndex)) nextIndex++;
        updates.push({
          type: "update",
          docPath: `profiles/${profile.id}`,
          data: { emailRotationIndex: nextIndex },
        });
        usedIndices.add(nextIndex);
        nextIndex++;
      }
    }

    // Commit in batches of 500 (Firestore REST batchWrite limit).
    for (let i = 0; i < updates.length; i += 500) {
      await firestoreBatchWrite(updates.slice(i, i + 500));
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
