import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { InstructorStatus } from "./types";

// Instructor registration response
type RegisterInstructorResponse = {
  ok: boolean;
  status: InstructorStatus;
  isAdmin: boolean;
};

// Instructor status check response
type CheckInstructorStatusResponse = {
  role: string;
  status: InstructorStatus | null;
  canAccess: boolean;
  rejectedReason?: string;
  revokedReason?: string;
};

// Instructor list item
type InstructorListItem = {
  uid: string;
  email: string;
  displayName: string;
  affiliation: string;
  status: InstructorStatus;
  appliedAt: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string;
  revokedAt?: string | null;
  revokedReason?: string;
  lastLoginAt?: string | null;
  sessionsCreated: number;
  activeSessions: number;
};

// Session list item
type SessionListItem = {
  sessionId: string;
  code: string;
  status: string;
  playersCount: number;
  weeks?: number;
  weekIndex?: number;
  createdAt: string | null;
};

export const api = {
  // Instructor auth
  registerInstructor: httpsCallable<
    { email: string; password: string; displayName: string; affiliation: string },
    RegisterInstructorResponse
  >(functions, "registerInstructor"),

  checkInstructorStatus: httpsCallable<void, CheckInstructorStatusResponse>(
    functions,
    "checkInstructorStatus"
  ),

  requestPasswordReset: httpsCallable<{ email: string }, { ok: boolean }>(
    functions,
    "requestPasswordReset"
  ),

  // Admin functions
  listPendingInstructors: httpsCallable<void, { instructors: InstructorListItem[] }>(
    functions,
    "listPendingInstructors"
  ),

  listAllInstructors: httpsCallable<
    { limit?: number; startAfterUid?: string; status?: string },
    { instructors: InstructorListItem[]; hasMore: boolean; lastUid: string | null }
  >(functions, "listAllInstructors"),

  getInstructorDetail: httpsCallable<
    { uid: string },
    { instructor: InstructorListItem; sessions: SessionListItem[] }
  >(functions, "getInstructorDetail"),

  approveInstructor: httpsCallable<{ uid: string }, { ok: boolean }>(
    functions,
    "approveInstructor"
  ),

  rejectInstructor: httpsCallable<{ uid: string; reason?: string }, { ok: boolean }>(
    functions,
    "rejectInstructor"
  ),

  revokeInstructorAccess: httpsCallable<
    { uid: string; reason?: string },
    { ok: boolean; sessionsEnded: number }
  >(functions, "revokeInstructorAccess"),

  getInstructorUsageStats: httpsCallable<
    void,
    {
      instructorCounts: { pending: number; approved: number; rejected: number; revoked: number };
      totalSessions: number;
      activeSessions: number;
    }
  >(functions, "getInstructorUsageStats"),

  // Instructor session functions
  getMySessions: httpsCallable<void, { sessions: SessionListItem[] }>(
    functions,
    "getMySessions"
  ),

  // Original session functions
  createSession: httpsCallable<
    { demandMu: number; demandSigma: number; price: number; cost: number; salvage: number; weeks: number },
    { sessionId: string; code: string }
  >(functions, "createSession"),

  joinSession: httpsCallable<
    { code: string; name: string; allowTakeover?: boolean },
    { sessionId: string; resumed?: boolean }
  >(
    functions,
    "joinSession"
  ),

  submitOrder: httpsCallable<{ sessionId: string; weekIndex: number; orderQty: number }, { ok: boolean }>(
    functions,
    "submitOrder"
  ),

  advanceReveal: httpsCallable<{ sessionId: string }, { ok: boolean; revealIndex: number }>(
    functions,
    "advanceReveal"
  ),

  nudgePlayer: httpsCallable<{ sessionId: string; uid: string }, { ok: boolean }>(
    functions,
    "nudgePlayer"
  ),

  endSession: httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    "endSession"
  ),

  deleteSession: httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    "deleteSession"
  ),

  startSession: httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    "startSession"
  ),

  kickPlayer: httpsCallable<{ sessionId: string; uid: string }, { ok: boolean }>(
    functions,
    "kickPlayer"
  ),

  redrawSession: httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    "redrawSession"
  ),

  finishWeek: httpsCallable<
    { sessionId: string },
    { ok: boolean; updated: number; defaultOrder?: number; message?: string }
  >(functions, "finishWeek"),
};
