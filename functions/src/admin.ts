import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAdmin } from "./auth";
import {
  sendInstructorApprovalEmail,
  sendInstructorRejectionEmail,
  sendInstructorRevocationEmail,
} from "./email";

function db() {
  return admin.firestore();
}

export const listPendingInstructors = onCall(async (request) => {
  await assertAdmin(request);

  const snapshot = await db()
    .collection("instructors")
    .where("status", "==", "pending")
    .orderBy("appliedAt", "desc")
    .get();

  const instructors = snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
    appliedAt: doc.data().appliedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return { instructors };
});

export const listAllInstructors = onCall(async (request) => {
  await assertAdmin(request);

  const limit = Math.min(100, Number(request.data?.limit) || 50);
  const startAfterUid = request.data?.startAfterUid as string | undefined;
  const statusFilter = request.data?.status as string | undefined;

  let query = db().collection("instructors").orderBy("appliedAt", "desc");

  if (statusFilter && ["pending", "approved", "rejected", "revoked"].includes(statusFilter)) {
    query = query.where("status", "==", statusFilter);
  }

  if (startAfterUid) {
    const startDoc = await db().collection("instructors").doc(startAfterUid).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  query = query.limit(limit);

  const snapshot = await query.get();
  const instructors = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      ...data,
      appliedAt: data.appliedAt?.toDate?.()?.toISOString() ?? null,
      approvedAt: data.approvedAt?.toDate?.()?.toISOString() ?? null,
      rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() ?? null,
      revokedAt: data.revokedAt?.toDate?.()?.toISOString() ?? null,
      lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return {
    instructors,
    hasMore: snapshot.docs.length === limit,
    lastUid: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
  };
});

export const getInstructorDetail = onCall(async (request) => {
  await assertAdmin(request);

  const instructorUid = String(request.data?.uid ?? "");
  if (!instructorUid) {
    throw new HttpsError("invalid-argument", "Instructor UID required.");
  }

  const instructorDoc = await db().collection("instructors").doc(instructorUid).get();
  if (!instructorDoc.exists) {
    throw new HttpsError("not-found", "Instructor not found.");
  }

  const data = instructorDoc.data()!;

  // Get their sessions
  const sessionsSnap = await db()
    .collection("sessions")
    .where("createdByUid", "==", instructorUid)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const sessions = sessionsSnap.docs.map((doc) => {
    const sData = doc.data();
    return {
      sessionId: doc.id,
      code: sData.code,
      status: sData.status,
      playersCount: sData.playersCount ?? 0,
      createdAt: sData.createdAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return {
    instructor: {
      uid: instructorDoc.id,
      ...data,
      appliedAt: data.appliedAt?.toDate?.()?.toISOString() ?? null,
      approvedAt: data.approvedAt?.toDate?.()?.toISOString() ?? null,
      rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() ?? null,
      revokedAt: data.revokedAt?.toDate?.()?.toISOString() ?? null,
      lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() ?? null,
    },
    sessions,
  };
});

export const approveInstructor = onCall(async (request) => {
  await assertAdmin(request);

  const instructorUid = String(request.data?.uid ?? "");
  if (!instructorUid) {
    throw new HttpsError("invalid-argument", "Instructor UID required.");
  }

  const instructorRef = db().collection("instructors").doc(instructorUid);
  const instructorDoc = await instructorRef.get();
  if (!instructorDoc.exists) {
    throw new HttpsError("not-found", "Instructor not found.");
  }

  const data = instructorDoc.data()!;
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", `Cannot approve instructor with status: ${data.status}`);
  }

  // Update Firestore
  await instructorRef.update({
    status: "approved",
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update custom claims
  await admin.auth().setCustomUserClaims(instructorUid, { role: "instructor" });

  // Send approval email
  try {
    await sendInstructorApprovalEmail(data.email, data.displayName);
  } catch (emailErr) {
    console.error("Failed to send approval email:", emailErr);
  }

  return { ok: true };
});

export const rejectInstructor = onCall(async (request) => {
  await assertAdmin(request);

  const instructorUid = String(request.data?.uid ?? "");
  const reason = String(request.data?.reason ?? "").trim();

  if (!instructorUid) {
    throw new HttpsError("invalid-argument", "Instructor UID required.");
  }

  const instructorRef = db().collection("instructors").doc(instructorUid);
  const instructorDoc = await instructorRef.get();
  if (!instructorDoc.exists) {
    throw new HttpsError("not-found", "Instructor not found.");
  }

  const data = instructorDoc.data()!;
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", `Cannot reject instructor with status: ${data.status}`);
  }

  // Update Firestore
  const updateData: Record<string, any> = {
    status: "rejected",
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (reason) {
    updateData.rejectedReason = reason;
  }
  await instructorRef.update(updateData);

  // Remove instructor claim (set to player)
  await admin.auth().setCustomUserClaims(instructorUid, { role: "player" });

  // Send rejection email
  try {
    await sendInstructorRejectionEmail(data.email, data.displayName, reason);
  } catch (emailErr) {
    console.error("Failed to send rejection email:", emailErr);
  }

  return { ok: true };
});

export const revokeInstructorAccess = onCall(async (request) => {
  await assertAdmin(request);

  const instructorUid = String(request.data?.uid ?? "");
  const reason = String(request.data?.reason ?? "").trim();

  if (!instructorUid) {
    throw new HttpsError("invalid-argument", "Instructor UID required.");
  }

  const instructorRef = db().collection("instructors").doc(instructorUid);
  const instructorDoc = await instructorRef.get();
  if (!instructorDoc.exists) {
    throw new HttpsError("not-found", "Instructor not found.");
  }

  const data = instructorDoc.data()!;
  if (data.status !== "approved") {
    throw new HttpsError("failed-precondition", `Cannot revoke instructor with status: ${data.status}`);
  }

  // End all active sessions for this instructor
  const activeSessions = await db()
    .collection("sessions")
    .where("createdByUid", "==", instructorUid)
    .where("status", "in", ["lobby", "training", "ordering", "revealing"])
    .get();

  const batch = db().batch();
  activeSessions.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "finished" });
  });

  // Update instructor status
  const updateData: Record<string, any> = {
    status: "revoked",
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    activeSessions: 0,
  };
  if (reason) {
    updateData.revokedReason = reason;
  }
  batch.update(instructorRef, updateData);

  await batch.commit();

  // Remove instructor claim (set to player)
  await admin.auth().setCustomUserClaims(instructorUid, { role: "player" });

  // Send revocation email
  try {
    await sendInstructorRevocationEmail(data.email, data.displayName, reason);
  } catch (emailErr) {
    console.error("Failed to send revocation email:", emailErr);
  }

  return { ok: true, sessionsEnded: activeSessions.docs.length };
});

export const getInstructorUsageStats = onCall(async (request) => {
  await assertAdmin(request);

  // Get counts by status
  const statusCounts: Record<string, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    revoked: 0,
  };

  const allInstructors = await db().collection("instructors").get();
  allInstructors.docs.forEach((doc) => {
    const status = doc.data().status;
    if (status in statusCounts) {
      statusCounts[status]++;
    }
  });

  // Get total sessions and active sessions
  const allSessions = await db().collection("sessions").get();
  let totalSessions = allSessions.size;
  let activeSessions = 0;
  allSessions.docs.forEach((doc) => {
    const status = doc.data().status;
    if (["lobby", "training", "ordering", "revealing"].includes(status)) {
      activeSessions++;
    }
  });

  return {
    instructorCounts: statusCounts,
    totalSessions,
    activeSessions,
  };
});
