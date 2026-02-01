import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { isAdminEmail } from "./auth";
import { sendAdminNewApplicationNotification } from "./email";

export const registerInstructor = onCall(async (request) => {
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    const password = String(request.data?.password ?? "");
    const displayName = String(request.data?.displayName ?? "").trim();
    const affiliation = String(request.data?.affiliation ?? "").trim();

    if (!email || !password || !displayName || !affiliation) {
      throw new HttpsError("invalid-argument", "All fields are required.");
    }

    if (password.length < 8) {
      throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    // Check if this is an admin email
    const isAdmin = isAdminEmail(email);

    try {
      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      const uid = userRecord.uid;
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (isAdmin) {
        // Admin users are auto-approved
        await admin.auth().setCustomUserClaims(uid, { role: "admin" });
        await admin.firestore().collection("instructors").doc(uid).set({
          uid,
          email,
          displayName,
          affiliation,
          status: "approved",
          appliedAt: now,
          approvedAt: now,
          lastLoginAt: null,
          sessionsCreated: 0,
          activeSessions: 0,
        });
        return { ok: true, status: "approved", isAdmin: true };
      } else {
        // Regular instructors start as pending
        await admin.auth().setCustomUserClaims(uid, { role: "instructor" });
        await admin.firestore().collection("instructors").doc(uid).set({
          uid,
          email,
          displayName,
          affiliation,
          status: "pending",
          appliedAt: now,
          lastLoginAt: null,
          sessionsCreated: 0,
          activeSessions: 0,
        });

        // Send notification to admin
        try {
          await sendAdminNewApplicationNotification(displayName, email, affiliation);
        } catch (emailErr) {
          console.error("Failed to send admin notification email:", emailErr);
        }

        return { ok: true, status: "pending", isAdmin: false };
      }
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "An account with this email already exists.");
      }
      console.error("Registration error:", error);
      throw new HttpsError("internal", "Failed to create account.");
    }
  }
);

export const checkInstructorStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in.");
  }

  const uid = request.auth.uid;
  const user = await admin.auth().getUser(uid);
  let role = (user.customClaims?.role as string | undefined) ?? "player";

  // Auto-promote admin emails on login
  if (role !== "admin" && user.email && isAdminEmail(user.email)) {
    await admin.auth().setCustomUserClaims(uid, { role: "admin" });
    role = "admin";

    // Create or update instructor doc
    const instructorRef = admin.firestore().collection("instructors").doc(uid);
    const instructorDoc = await instructorRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!instructorDoc.exists) {
      await instructorRef.set({
        uid,
        email: user.email,
        displayName: user.displayName || user.email,
        affiliation: "Admin",
        status: "approved",
        appliedAt: now,
        approvedAt: now,
        lastLoginAt: now,
        sessionsCreated: 0,
        activeSessions: 0,
      });
    } else {
      await instructorRef.update({
        status: "approved",
        lastLoginAt: now,
      });
    }

    return { role: "admin", status: "approved", canAccess: true };
  }

  // If admin, return immediately
  if (role === "admin") {
    return { role: "admin", status: "approved", canAccess: true };
  }

  // If not instructor role, not an instructor
  if (role !== "instructor") {
    return { role, status: null, canAccess: false };
  }

  // Get instructor doc
  const instructorDoc = await admin.firestore().collection("instructors").doc(uid).get();
  if (!instructorDoc.exists) {
    return { role: "instructor", status: null, canAccess: false };
  }

  const data = instructorDoc.data();
  const status = data?.status;

  // Update last login
  await instructorDoc.ref.update({
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    role: "instructor",
    status,
    canAccess: status === "approved",
    rejectedReason: data?.rejectedReason,
    revokedReason: data?.revokedReason,
  };
});

export const requestPasswordReset = onCall(async (request) => {
  const email = String(request.data?.email ?? "").trim().toLowerCase();

  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  try {
    // Generate password reset link - Firebase will send the email
    await admin.auth().generatePasswordResetLink(email);
    return { ok: true };
  } catch (error: any) {
    // Don't reveal if email exists or not for security
    console.error("Password reset error:", error);
    return { ok: true };
  }
});
