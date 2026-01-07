import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

export async function assertHost(context: any) {
  if (!context.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const user = await admin.auth().getUser(context.auth.uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";
  if (role !== "host") throw new HttpsError("permission-denied", "Host only.");
}
