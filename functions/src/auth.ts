import * as admin from "firebase-admin";

export async function assertHost(context: any) {
  if (!context.auth) throw new Error("Unauthenticated");
  const user = await admin.auth().getUser(context.auth.uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";
  if (role !== "host") throw new Error("Permission denied: host only");
}
