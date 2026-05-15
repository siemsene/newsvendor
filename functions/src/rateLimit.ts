import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { HttpsError } from "firebase-functions/v2/https";

export function getClientIp(rawRequest: any): string {
  const xff = rawRequest?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return String(rawRequest?.ip ?? "unknown");
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function checkAndRecordIp(
  ip: string,
  scope: string,
  opts: { maxPerHour: number }
): Promise<void> {
  const db = admin.firestore();
  const docId = `${scope}_${hashIp(ip)}`;
  const ref = db.collection("rateLimits").doc(docId);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.data()?.timestamps as number[]) ?? [];
    const recent = existing.filter((t) => now - t < windowMs);

    if (recent.length >= opts.maxPerHour) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts from this address. Please try again later."
      );
    }

    recent.push(now);
    tx.set(ref, { timestamps: recent, updatedAt: now });
  });
}
