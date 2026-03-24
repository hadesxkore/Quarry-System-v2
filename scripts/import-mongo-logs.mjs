/**
 * import-mongo-logs.mjs
 * ---------------------
 * Imports old MongoDB truck log records into Firestore (manualTruckLogs collection).
 *
 * Field mapping:
 *   logType "in"/"out"  → truckMovement "Truck In"/"Truck Out"
 *   truckStatus "empty"/"full"/"half-loaded" → "Empty"/"Full"/"Half Loaded"
 *   logDate.$date       → logDateTime (ISO string, kept as-is)
 *   quarryId.$oid       → resolved to quarryName + quarryMunicipality via quarries.json
 *
 * Usage:
 *   node scripts/import-mongo-logs.mjs
 *
 * Requires: npm install firebase-admin  (run once from project root)
 */

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, WriteBatch } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Paths ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_PATH     = "C:/Users/USER/Downloads/quarry.admintrucklogs.json";
const QUARRIES_PATH = "C:/Users/USER/Downloads/quarry.quarries.json";

// ── Firebase Admin — uses Application Default Credentials ─────────────────────
// Point this to your Firebase service-account key JSON.
// Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
const SERVICE_ACCOUNT_PATH = join(__dirname, "serviceAccountKey.json");

let app;
try {
    app = initializeApp({
        credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
    });
    console.log("✅ Firebase Admin initialized");
} catch (e) {
    console.error("❌ Could not initialize Firebase Admin.");
    console.error(`   Place your service account key at:\n   ${SERVICE_ACCOUNT_PATH}`);
    console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
    process.exit(1);
}

const db = getFirestore(app);

// ── Load JSON files ───────────────────────────────────────────────────────────
const rawLogs     = JSON.parse(readFileSync(LOGS_PATH, "utf8"));
const rawQuarries = JSON.parse(readFileSync(QUARRIES_PATH, "utf8"));

// ── Build quarryId → { name, municipality } lookup ───────────────────────────
const quarryMap = new Map();
for (const q of rawQuarries) {
    const id   = q._id?.$oid;
    const name = q.proponent || q.name || q.permitNumber || "Unknown Quarry";
    // location is like "Dangcol, Balanga City" — extract municipality part
    const locationParts = (q.location || "").split(",");
    const municipality  = locationParts.length > 1
        ? locationParts[locationParts.length - 1].trim()
        : (q.location || "");
    if (id) quarryMap.set(id, { name, municipality });
}
console.log(`📦 Loaded ${rawQuarries.length} quarry records → ${quarryMap.size} unique IDs`);

// ── Field mappers ─────────────────────────────────────────────────────────────
function mapMovement(logType) {
    if (logType === "in")  return "Truck In";
    if (logType === "out") return "Truck Out";
    return logType ?? "";
}

function mapStatus(truckStatus) {
    if (!truckStatus) return "";
    const s = truckStatus.toLowerCase();
    if (s === "empty")        return "Empty";
    if (s === "full")         return "Full";
    if (s === "half-loaded" || s === "half loaded") return "Half Loaded";
    return truckStatus; // keep as-is if unknown
}

// ── Import in Firestore batch writes (max 500 per batch) ──────────────────────
const BATCH_SIZE = 400;
const col = db.collection("manualTruckLogs");

let written = 0, skipped = 0;
const total = rawLogs.length;

console.log(`\n🚚 Starting import of ${total} records…\n`);

for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = rawLogs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const log of chunk) {
        const mongoId   = log._id?.$oid;
        const quarryOid = log.quarryId?.$oid;
        const logDateRaw = log.logDate?.$date;

        if (!logDateRaw) { skipped++; continue; }

        // Resolve quarry info
        const quarryInfo = quarryMap.get(quarryOid) ?? {
            name: `Unknown Quarry (${quarryOid ?? "no-id"})`,
            municipality: "",
        };

        // Build Firestore document — use mongo _id as the doc ID to make the
        // import idempotent (re-running won't create duplicates).
        const docRef = mongoId ? col.doc(`mongo_${mongoId}`) : col.doc();

        batch.set(docRef, {
            // source marker so you can identify imported records if needed
            _importedFromMongo: true,
            _mongoId: mongoId ?? null,

            quarryId:          quarryOid  ?? "",
            quarryName:        quarryInfo.name,
            quarryMunicipality: quarryInfo.municipality,

            truckMovement: mapMovement(log.logType),
            truckStatus:   mapStatus(log.truckStatus),
            truckCount:    String(log.truckCount ?? 1),
            logDateTime:   logDateRaw,           // ISO string — matches app's format
            imageUrl:      "",                   // old image paths won't resolve

            createdAt: log.createdAt?.$date
                ? Timestamp.fromDate(new Date(log.createdAt.$date))
                : Timestamp.now(),
        }, { merge: false });

        written++;
    }

    await batch.commit();
    const pct = Math.round(((i + chunk.length) / total) * 100);
    console.log(`  ✓ Batch committed — ${Math.min(i + chunk.length, total)}/${total} (${pct}%)`);
}

console.log(`\n🎉 Import complete!`);
console.log(`   Written : ${written}`);
console.log(`   Skipped : ${skipped} (missing logDate)`);
console.log(`\n   Open the Reports page — all imported logs are now in manualTruckLogs.`);
