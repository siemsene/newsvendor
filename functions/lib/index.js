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
exports.kickPlayer = exports.endSession = exports.redrawSession = exports.startSession = exports.advanceReveal = exports.nudgePlayer = exports.submitOrder = exports.joinSession = exports.createSession = exports.hostLogin = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const demand_1 = require("./demand");
const profit_1 = require("./profit");
const auth_1 = require("./auth");
admin.initializeApp();
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({ region: "us-central1" });
function requireAuth(context) {
    if (!context.auth)
        throw new https_1.HttpsError("unauthenticated", "Please sign in.");
    return context.auth.uid;
}
function makeCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++)
        out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}
exports.hostLogin = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const password = (request.data?.password ?? "");
    const secret = process.env.HOST_PASSWORD;
    if (!secret) {
        if (password !== "Sesame") {
            throw new https_1.HttpsError("permission-denied", "Wrong host password.");
        }
    }
    else if (password !== secret) {
        throw new https_1.HttpsError("permission-denied", "Wrong host password.");
    }
    await admin.auth().setCustomUserClaims(uid, { role: "host" });
    return { ok: true };
});
exports.createSession = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    await (0, auth_1.assertHost)(request);
    const demandMu = Number(request.data?.demandMu ?? 50);
    const demandSigma = Number(request.data?.demandSigma ?? 20);
    const price = Number(request.data?.price ?? 1.0);
    const cost = Number(request.data?.cost ?? 0.2);
    const salvage = Number(request.data?.salvage ?? 0.0);
    const weeks = Math.round(Number(request.data?.weeks ?? 10));
    if (!(demandSigma > 0))
        throw new https_1.HttpsError("invalid-argument", "demandSigma must be > 0");
    if (!(price > 0))
        throw new https_1.HttpsError("invalid-argument", "price must be > 0");
    if (!(weeks >= 1 && weeks <= 52))
        throw new https_1.HttpsError("invalid-argument", "weeks must be between 1 and 52");
    const code = makeCode();
    const sessionRef = db.collection("sessions").doc();
    const sessionId = sessionRef.id;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const nGame = weeks * 5;
    const dataset = (0, demand_1.generateDemandDataset)({ mu: demandMu, sigma: demandSigma, nTrain: 50, nGame, price, cost, salvage }, seed);
    const drawFailed = dataset.training.length === 0 || dataset.inGame.length === 0;
    await sessionRef.set({
        code,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUid: uid,
        demandMu,
        demandSigma,
        price,
        cost,
        salvage,
        weeks,
        status: "training",
        weekIndex: 0,
        revealIndex: 0,
        trainingDemands: dataset.training,
        revealedDemands: [],
        optimalQ: dataset.optimalQ,
        showLeaderboard: false,
        drawFailed,
    });
    await sessionRef.collection("private").doc("demand").set({
        inGameDemands: dataset.inGame,
        seed,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { sessionId, code };
});
exports.joinSession = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const code = String(request.data?.code ?? "").trim().toUpperCase();
    const name = String(request.data?.name ?? "").trim();
    if (!code)
        throw new https_1.HttpsError("invalid-argument", "Missing session code.");
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "Missing name.");
    const snap = await db.collection("sessions").where("code", "==", code).limit(1).get();
    if (snap.empty)
        throw new https_1.HttpsError("not-found", "Session code not found.");
    const sessionDoc = snap.docs[0];
    const session = sessionDoc.data();
    const weeks = Math.round(Number(session?.weeks ?? 10));
    const sessionId = sessionDoc.id;
    const playerRef = db.collection("sessions").doc(sessionId).collection("players").doc(uid);
    await playerRef.set({
        name,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        ordersByWeek: Array.from({ length: Math.max(1, weeks) }, () => null),
        dailyProfit: [],
        cumulativeProfit: 0,
        submittedWeek: null,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        lastNudgedAt: null,
    }, { merge: true });
    return { sessionId };
});
exports.submitOrder = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const sessionId = String(request.data?.sessionId ?? "");
    const weekIndex = Number(request.data?.weekIndex ?? 0);
    const orderQty = Math.max(0, Math.round(Number(request.data?.orderQty ?? 0)));
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    const weeks = Math.round(Number(session.weeks ?? 10));
    if (!(weekIndex >= 0 && weekIndex < weeks))
        throw new https_1.HttpsError("invalid-argument", "Invalid weekIndex.");
    if (!["training", "ordering"].includes(session.status)) {
        throw new https_1.HttpsError("failed-precondition", "Not accepting orders right now.");
    }
    if (session.weekIndex !== weekIndex) {
        throw new https_1.HttpsError("failed-precondition", `Week mismatch. Current week is ${session.weekIndex}.`);
    }
    const playerRef = sessionRef.collection("players").doc(uid);
    await db.runTransaction(async (tx) => {
        const pSnap = await tx.get(playerRef);
        if (!pSnap.exists)
            throw new https_1.HttpsError("not-found", "Player doc not found. Join session first.");
        const p = pSnap.data();
        const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
        const orders = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
        orders[weekIndex] = orderQty;
        tx.set(playerRef, {
            ordersByWeek: orders,
            submittedWeek: weekIndex,
            lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        if (session.status === "training") {
            tx.update(sessionRef, { status: "ordering" });
        }
    });
    return { ok: true };
});
exports.nudgePlayer = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    const targetUid = String(request.data?.uid ?? "");
    if (!sessionId || !targetUid)
        throw new https_1.HttpsError("invalid-argument", "Missing args.");
    const ref = db.collection("sessions").doc(sessionId).collection("players").doc(targetUid);
    await ref.set({ lastNudgedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("sessions").doc(sessionId).collection("events").add({
        type: "nudge",
        uid: targetUid,
        at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.advanceReveal = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const privateRef = sessionRef.collection("private").doc("demand");
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    const revealIndex = session.revealIndex ?? 0;
    const weeks = Math.round(Number(session.weeks ?? 10));
    const totalDays = weeks * 5;
    if (revealIndex >= totalDays)
        throw new https_1.HttpsError("failed-precondition", "All days already revealed.");
    const privateSnap = await privateRef.get();
    if (!privateSnap.exists)
        throw new https_1.HttpsError("not-found", "Private demand doc missing.");
    const inGame = privateSnap.data().inGameDemands;
    if (!Array.isArray(inGame) || inGame.length < totalDays) {
        throw new https_1.HttpsError("internal", "Invalid in-game demand series.");
    }
    const D = inGame[revealIndex];
    const dayIndex = revealIndex;
    const weekIndex = Math.floor(dayIndex / 5);
    const playersSnap = await sessionRef.collection("players").get();
    const batch = db.batch();
    const revealedDemands = Array.isArray(session.revealedDemands) ? session.revealedDemands.slice() : [];
    revealedDemands.push(D);
    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);
    const lbRows = [];
    playersSnap.docs.forEach((pdoc) => {
        const p = pdoc.data();
        const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
        const orders = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
        const Q = Math.max(0, Math.round(Number(orders[weekIndex] ?? 0)));
        const pf = (0, profit_1.profitForDay)(D, Q, price, cost, salvage);
        const dailyProfit = Array.isArray(p.dailyProfit) ? p.dailyProfit.slice() : [];
        dailyProfit.push(pf);
        const cumulativeProfit = Number(p.cumulativeProfit ?? 0) + pf;
        batch.set(pdoc.ref, {
            dailyProfit,
            cumulativeProfit,
            lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const submittedOrders = orders.filter((x) => typeof x === "number");
        const avgOrder = submittedOrders.length ? submittedOrders.reduce((a, b) => a + b, 0) / submittedOrders.length : 0;
        lbRows.push({
            uid: pdoc.id,
            name: String(p.name ?? "Anonymous"),
            profit: cumulativeProfit,
            avgOrder,
        });
    });
    lbRows.sort((a, b) => b.profit - a.profit);
    const nextReveal = revealIndex + 1;
    let nextStatus = String(session.status ?? "training");
    let nextWeek = Number(session.weekIndex ?? 0);
    if (nextReveal === totalDays) {
        nextStatus = "finished";
        nextWeek = Math.max(0, weeks - 1);
    }
    else if (nextReveal % 5 === 0) {
        nextWeek = Math.min(weeks - 1, weekIndex + 1);
        nextStatus = "ordering";
    }
    else {
        nextStatus = "revealing";
    }
    batch.update(sessionRef, {
        revealedDemands,
        revealIndex: nextReveal,
        weekIndex: nextWeek,
        status: nextStatus,
        leaderboard: lbRows.slice(0, 50),
    });
    await batch.commit();
    return { ok: true, revealIndex: nextReveal };
});
exports.startSession = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    if (session.status !== "training") {
        throw new https_1.HttpsError("failed-precondition", "Session already started.");
    }
    await sessionRef.update({
        status: "ordering",
        weekIndex: 0,
        revealIndex: 0,
    });
    return { ok: true };
});
exports.redrawSession = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    if (session.status !== "training") {
        throw new https_1.HttpsError("failed-precondition", "Session already started.");
    }
    const seed = Math.floor(Math.random() * 2 ** 31);
    const weeks = Math.round(Number(session.weeks ?? 10));
    const dataset = (0, demand_1.generateDemandDataset)({
        mu: Number(session.demandMu ?? 50),
        sigma: Number(session.demandSigma ?? 20),
        nTrain: 50,
        nGame: weeks * 5,
        price: Number(session.price ?? 1.0),
        cost: Number(session.cost ?? 0.2),
        salvage: Number(session.salvage ?? 0.0),
    }, seed);
    const drawFailed = dataset.training.length === 0 || dataset.inGame.length === 0;
    if (drawFailed) {
        await sessionRef.update({ drawFailed: true });
        return { ok: false };
    }
    await sessionRef.update({
        trainingDemands: dataset.training,
        revealedDemands: [],
        optimalQ: dataset.optimalQ,
        weekIndex: 0,
        revealIndex: 0,
        status: "training",
        leaderboard: [],
        drawFailed: false,
    });
    await sessionRef.collection("private").doc("demand").set({
        inGameDemands: dataset.inGame,
        seed,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.endSession = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    const weeks = Math.round(Number(session?.weeks ?? 10));
    const totalDays = weeks * 5;
    await sessionRef.update({
        status: "finished",
        revealIndex: totalDays,
        weekIndex: Math.max(0, weeks - 1),
    });
    return { ok: true };
});
exports.kickPlayer = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    const uid = String(request.data?.uid ?? "");
    if (!sessionId || !uid)
        throw new https_1.HttpsError("invalid-argument", "Missing args.");
    const playerRef = db.collection("sessions").doc(sessionId).collection("players").doc(uid);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists)
        throw new https_1.HttpsError("not-found", "Player not found.");
    await playerRef.delete();
    return { ok: true };
});
