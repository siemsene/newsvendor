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
exports.assertAdmin = assertAdmin;
exports.assertInstructor = assertInstructor;
exports.assertHost = assertHost;
exports.assertSessionOwner = assertSessionOwner;
exports.isAdminEmail = isAdminEmail;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const ADMIN_EMAILS = ["siemsene@gmail.com"];
async function assertAdmin(context) {
    if (!context.auth)
        throw new https_1.HttpsError("unauthenticated", "Please sign in.");
    const user = await admin.auth().getUser(context.auth.uid);
    const role = user.customClaims?.role ?? "player";
    if (role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin only.");
    }
    return context.auth.uid;
}
async function assertInstructor(context) {
    if (!context.auth)
        throw new https_1.HttpsError("unauthenticated", "Please sign in.");
    const uid = context.auth.uid;
    const user = await admin.auth().getUser(uid);
    const role = user.customClaims?.role ?? "player";
    // Admin can do anything instructor can do
    if (role === "admin") {
        return uid;
    }
    // Check if instructor role
    if (role !== "instructor") {
        throw new https_1.HttpsError("permission-denied", "Instructor access required.");
    }
    // Check approval status
    const db = admin.firestore();
    const instructorDoc = await db.collection("instructors").doc(uid).get();
    if (!instructorDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "Instructor profile not found.");
    }
    const status = instructorDoc.data()?.status;
    if (status !== "approved") {
        if (status === "pending") {
            throw new https_1.HttpsError("permission-denied", "Your account is pending approval.");
        }
        else if (status === "rejected") {
            throw new https_1.HttpsError("permission-denied", "Your application was not approved.");
        }
        else if (status === "revoked") {
            throw new https_1.HttpsError("permission-denied", "Your access has been revoked.");
        }
        throw new https_1.HttpsError("permission-denied", "Instructor access not approved.");
    }
    return uid;
}
// Backwards compatible - accepts host, instructor, or admin
async function assertHost(context) {
    if (!context.auth)
        throw new https_1.HttpsError("unauthenticated", "Please sign in.");
    const uid = context.auth.uid;
    const user = await admin.auth().getUser(uid);
    const role = user.customClaims?.role ?? "player";
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
            throw new https_1.HttpsError("permission-denied", "Instructor profile not found.");
        }
        const status = instructorDoc.data()?.status;
        if (status !== "approved") {
            throw new https_1.HttpsError("permission-denied", "Instructor access not approved.");
        }
        return uid;
    }
    throw new https_1.HttpsError("permission-denied", "Host/Instructor only.");
}
async function assertSessionOwner(context, sessionId) {
    const uid = await assertHost(context);
    const user = await admin.auth().getUser(uid);
    const role = user.customClaims?.role ?? "player";
    // Admin can access any session
    if (role === "admin") {
        return uid;
    }
    // Check session ownership
    const db = admin.firestore();
    const sessionDoc = await db.collection("sessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
        throw new https_1.HttpsError("not-found", "Session not found.");
    }
    const createdByUid = sessionDoc.data()?.createdByUid;
    if (createdByUid !== uid) {
        throw new https_1.HttpsError("permission-denied", "You do not own this session.");
    }
    return uid;
}
function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(email.toLowerCase());
}
