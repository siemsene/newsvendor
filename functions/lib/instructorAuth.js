"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = exports.checkInstructorStatus = exports.registerInstructor = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./auth");
const email_1 = require("./email");
exports.registerInstructor = (0, https_1.onCall)(async (request) => {
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    const password = String(request.data?.password ?? "");
    const displayName = String(request.data?.displayName ?? "").trim();
    const affiliation = String(request.data?.affiliation ?? "").trim();
    if (!email || !password || !displayName || !affiliation) {
        throw new https_1.HttpsError("invalid-argument", "All fields are required.");
    }
    if (password.length < 8) {
        throw new https_1.HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }
    // Check if this is an admin email
    const isAdmin = (0, auth_1.isAdminEmail)(email);
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
        }
        else {
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
                await (0, email_1.sendAdminNewApplicationNotification)(displayName, email, affiliation);
            }
            catch (emailErr) {
                console.error("Failed to send admin notification email:", emailErr);
            }
            return { ok: true, status: "pending", isAdmin: false };
        }
    }
    catch (error) {
        if (error.code === "auth/email-already-exists") {
            throw new https_1.HttpsError("already-exists", "An account with this email already exists.");
        }
        console.error("Registration error:", error);
        throw new https_1.HttpsError("internal", "Failed to create account.");
    }
});
exports.checkInstructorStatus = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Please sign in.");
    }
    const uid = request.auth.uid;
    const user = await admin.auth().getUser(uid);
    let role = user.customClaims?.role ?? "player";
    // Auto-promote admin emails on login
    if (role !== "admin" && user.email && (0, auth_1.isAdminEmail)(user.email)) {
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
        }
        else {
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
exports.requestPasswordReset = (0, https_1.onCall)(async (request) => {
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Email is required.");
    }
    try {
        // Generate password reset link - Firebase will send the email
        await admin.auth().generatePasswordResetLink(email);
        return { ok: true };
    }
    catch (error) {
        // Don't reveal if email exists or not for security
        console.error("Password reset error:", error);
        return { ok: true };
    }
});
