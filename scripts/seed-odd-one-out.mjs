/**
 * seed-odd-one-out.mjs
 * ---------------------
 * Calls the /api/admin/seed-odd-one-out route to batch-write all
 * 10 VARC Odd One Out TITA questions into Firestore via the Admin SDK.
 *
 * Usage (run against local dev server OR production):
 *   node scripts/seed-odd-one-out.mjs                        # local
 *   node scripts/seed-odd-one-out.mjs https://your-app.vercel.app  # prod
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

// Load .env.local
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/\r$/, "")];
    })
);

const CRON_SECRET = envVars["CRON_SECRET"];
const BASE = process.argv[2] ?? "http://localhost:3000";
const URL  = `${BASE}/api/admin/seed-odd-one-out`;

if (!CRON_SECRET) {
  console.error("❌  CRON_SECRET not found in .env.local");
  process.exit(1);
}

console.log(`\n📡  Calling ${URL} ...\n`);

const res = await fetch(URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
});

const body = await res.json();

if (res.ok) {
  console.log("✅ ", body.message);
  if (body.skipped) console.log("   (no changes made — already seeded)");
  else console.log(`   ${body.count} questions added to Firestore.`);
} else {
  console.error("❌  Error:", body.error ?? JSON.stringify(body));
  process.exit(1);
}

console.log("\n🎉  Done! Open Practice → VARC → Odd One Out in the app.\n");
