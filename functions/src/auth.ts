import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

const ADMIN_EMAILS = ["siemsene@gmail.com"];

export async function assertAdmin(context: any): Promise<string> {
  if (!context.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const user = await admin.auth().getUser(context.auth.uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  return context.auth.uid;
}

export async function assertInstructor(context: any): Promise<string> {
  if (!context.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const uid = context.auth.uid;
  const user = await admin.auth().getUser(uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";

  // Admin can do anything instructor can do
  if (role === "admin") {
    return uid;
  }

  // Check if instructor role
  if (role !== "instructor") {
    throw new HttpsError("permission-denied", "Instructor access required.");
  }

  // Check approval status
  const db = admin.firestore();
  const instructorDoc = await db.collection("instructors").doc(uid).get();
  if (!instructorDoc.exists) {
    throw new HttpsError("permission-denied", "Instructor profile not found.");
  }

  const status = instructorDoc.data()?.status;
  if (status !== "approved") {
    if (status === "pending") {
      throw new HttpsError("permission-denied", "Your account is pending approval.");
    } else if (status === "rejected") {
      throw new HttpsError("permission-denied", "Your application was not approved.");
    } else if (status === "revoked") {
      throw new HttpsError("permission-denied", "Your access has been revoked.");
    }
    throw new HttpsError("permission-denied", "Instructor access not approved.");
  }

  return uid;
}

// Backwards compatible - accepts host, instructor, or admin
export async function assertHost(context: any): Promise<string> {
  if (!context.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const uid = context.auth.uid;
  const user = await admin.auth().getUser(uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";

  // Admin can do anything
  if (role === "admin") {
    return uid;
  }

  // Legacy host role still works
  if (role === "host") {
    return uid;
  }

  // Instructor role requires approval check
  if (role === "instructor") {
    const db = admin.firestore();
    const instructorDoc = await db.collection("instructors").doc(uid).get();
    if (!instructorDoc.exists) {
      throw new HttpsError("permission-denied", "Instructor profile not found.");
    }
    const status = instructorDoc.data()?.status;
    if (status !== "approved") {
      throw new HttpsError("permission-denied", "Instructor access not approved.");
    }
    return uid;
  }

  throw new HttpsError("permission-denied", "Host/Instructor only.");
}

export async function assertSessionOwner(context: any, sessionId: string): Promise<string> {
  const uid = await assertHost(context);
  const user = await admin.auth().getUser(uid);
  const role = (user.customClaims?.role as string | undefined) ?? "player";

  // Admin can access any session
  if (role === "admin") {
    return uid;
  }

  // Check session ownership
  const db = admin.firestore();
  const sessionDoc = await db.collection("sessions").doc(sessionId).get();
  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "Session not found.");
  }

  const createdByUid = sessionDoc.data()?.createdByUid;
  if (createdByUid !== uid) {
    throw new HttpsError("permission-denied", "You do not own this session.");
  }

  return uid;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
