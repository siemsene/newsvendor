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
exports.cleanupOldSessions = exports.kickPlayer = exports.finishWeek = exports.endSession = exports.redrawSession = exports.startSession = exports.advanceReveal = exports.nudgePlayer = exports.submitOrder = exports.joinSession = exports.createSession = exports.hostLogin = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const demand_1 = require("./demand");
const profit_1 = require("./profit");
const auth_1 = require("./auth");
admin.initializeApp();
const db = admin.firestore();
const hostPassword = (0, params_1.defineSecret)("HOST_PASSWORD");
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
function expandWeeklyOrdersToDays(ordersByWeek, totalDays) {
    const out = [];
    for (let i = 0; i < totalDays; i++) {
        const weekIndex = Math.floor(i / 5);
        const q = ordersByWeek[weekIndex];
        out.push(typeof q === "number" ? q : 0);
    }
    return out;
}
async function createSessionWithUniqueCode(payload) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = makeCode();
        const sessionRef = db.collection("sessions").doc();
        const privateRef = sessionRef.collection("private").doc("demand");
        const codeRef = db.collection("sessionCodes").doc(code);
        try {
            await db.runTransaction(async (tx) => {
                const codeSnap = await tx.get(codeRef);
                if (codeSnap.exists) {
                    throw new https_1.HttpsError("already-exists", "Code collision.");
                }
                tx.create(sessionRef, {
                    code,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdByUid: payload.uid,
                    demandMu: payload.demandMu,
                    demandSigma: payload.demandSigma,
                    price: payload.price,
                    cost: payload.cost,
                    salvage: payload.salvage,
                    weeks: payload.weeks,
                    status: "training",
                    weekIndex: 0,
                    revealIndex: 0,
                    trainingDemands: payload.dataset.training,
                    revealedDemands: [],
                    optimalQ: payload.dataset.optimalQ,
                    showLeaderboard: false,
                    drawFailed: payload.drawFailed,
                    playersCount: 0,
                    leaderboard: [],
                });
                tx.create(privateRef, {
                    inGameDemands: payload.dataset.inGame,
                    seed: payload.seed,
                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.create(codeRef, {
                    sessionId: sessionRef.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            return { sessionId: sessionRef.id, code };
        }
        catch (e) {
            if (e?.code === "already-exists")
                continue;
            throw e;
        }
    }
    throw new https_1.HttpsError("internal", "Failed to generate unique session code.");
}
exports.hostLogin = (0, https_1.onCall)({ secrets: [hostPassword] }, async (request) => {
    const uid = requireAuth(request);
    const password = (request.data?.password ?? "");
    const secret = hostPassword.value();
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
    const seed = Math.floor(Math.random() * 2 ** 31);
    const nGame = weeks * 5;
    const dataset = (0, demand_1.generateDemandDataset)({ mu: demandMu, sigma: demandSigma, nTrain: 50, nGame, price, cost, salvage }, seed);
    const drawFailed = dataset.training.length === 0 || dataset.inGame.length === 0;
    return createSessionWithUniqueCode({
        uid,
        demandMu,
        demandSigma,
        price,
        cost,
        salvage,
        weeks,
        dataset,
        seed,
        drawFailed,
    });
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
    const sessionId = sessionDoc.id;
    const sessionRef = db.collection("sessions").doc(sessionId);
    const playerRef = sessionRef.collection("players").doc(uid);
    let resumed = false;
    await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists)
            throw new https_1.HttpsError("not-found", "Session not found.");
        const session = sessionSnap.data();
        const weeks = Math.round(Number(session?.weeks ?? 10));
        const playerSnap = await tx.get(playerRef);
        // Check if this UID already has a player doc
        if (playerSnap.exists) {
            // Same UID rejoining - just update activity
            tx.set(playerRef, {
                name,
                isActive: true,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            resumed = true;
            return;
        }
        // Check if there's an existing player with the same name (case-insensitive)
        const playersSnap = await tx.get(sessionRef.collection("players"));
        const nameLower = name.toLowerCase();
        const existingPlayer = playersSnap.docs.find((doc) => String(doc.data().name ?? "").toLowerCase() === nameLower);
        if (existingPlayer && existingPlayer.id !== uid) {
            // Found existing player with same name but different UID - transfer their data
            const oldData = existingPlayer.data();
            const oldRef = existingPlayer.ref;
            // Create new player doc with the old data but new UID
            tx.create(playerRef, {
                name: oldData.name ?? name,
                joinedAt: oldData.joinedAt ?? admin.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                ordersByWeek: oldData.ordersByWeek ?? Array.from({ length: Math.max(1, weeks) }, () => null),
                dailyProfit: oldData.dailyProfit ?? [],
                cumulativeProfit: oldData.cumulativeProfit ?? 0,
                submittedWeek: oldData.submittedWeek ?? null,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
                lastNudgedAt: oldData.lastNudgedAt ?? null,
            });
            // Delete the old player doc
            tx.delete(oldRef);
            // Note: playersCount stays the same since we're transferring, not adding
            resumed = true;
        }
        else {
            // New player - create fresh record
            tx.create(playerRef, {
                name,
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                ordersByWeek: Array.from({ length: Math.max(1, weeks) }, () => null),
                dailyProfit: [],
                cumulativeProfit: 0,
                submittedWeek: null,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
                lastNudgedAt: null,
            });
            tx.update(sessionRef, { playersCount: admin.firestore.FieldValue.increment(1) });
        }
    });
    return { sessionId, resumed };
});
exports.submitOrder = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const sessionId = String(request.data?.sessionId ?? "");
    const weekIndex = Number(request.data?.weekIndex ?? 0);
    const orderQty = Math.max(0, Math.round(Number(request.data?.orderQty ?? 0)));
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const playerRef = sessionRef.collection("players").doc(uid);
    await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
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
    let nextReveal = 0;
    // Collect player updates to batch write outside transaction
    const playerUpdates = [];
    await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists)
            throw new https_1.HttpsError("not-found", "Session not found.");
        const session = sessionSnap.data();
        const revealIndex = session.revealIndex ?? 0;
        const weeks = Math.round(Number(session.weeks ?? 10));
        const totalDays = weeks * 5;
        if (revealIndex >= totalDays)
            throw new https_1.HttpsError("failed-precondition", "All days already revealed.");
        const privateSnap = await tx.get(privateRef);
        if (!privateSnap.exists)
            throw new https_1.HttpsError("not-found", "Private demand doc missing.");
        const inGame = privateSnap.data().inGameDemands;
        if (!Array.isArray(inGame) || inGame.length < totalDays) {
            throw new https_1.HttpsError("internal", "Invalid in-game demand series.");
        }
        const D = inGame[revealIndex];
        const dayIndex = revealIndex;
        const weekIndex = Math.floor(dayIndex / 5);
        const playersSnap = await tx.get(sessionRef.collection("players"));
        const revealedDemands = Array.isArray(session.revealedDemands) ? session.revealedDemands.slice() : [];
        revealedDemands.push(D);
        const price = Number(session.price ?? 1);
        const cost = Number(session.cost ?? 0.2);
        const salvage = Number(session.salvage ?? 0);
        const lbRows = [];
        // Calculate updates but don't write yet
        playersSnap.docs.forEach((pdoc) => {
            const p = pdoc.data();
            const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
            const orders = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
            const Q = Math.max(0, Math.round(Number(orders[weekIndex] ?? 0)));
            const pf = (0, profit_1.profitForDay)(D, Q, price, cost, salvage);
            const dailyProfit = Array.isArray(p.dailyProfit) ? p.dailyProfit.slice() : [];
            dailyProfit.push(pf);
            const cumulativeProfit = Number(p.cumulativeProfit ?? 0) + pf;
            // Queue for batch write outside transaction
            playerUpdates.push({ ref: pdoc.ref, dailyProfit, cumulativeProfit });
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
        nextReveal = revealIndex + 1;
        let nextStatus = String(session.status ?? "training");
        let nextWeek = Number(session.weekIndex ?? 0);
        let endgameAvgOrderPerDay = null;
        if (nextReveal === totalDays) {
            nextStatus = "finished";
            nextWeek = Math.max(0, weeks - 1);
            const playerDocs = playersSnap.docs;
            const nPlayers = playerDocs.length || 1;
            const sums = Array.from({ length: totalDays }, () => 0);
            playerDocs.forEach((pdoc) => {
                const p = pdoc.data();
                const orders = Array.isArray(p.ordersByWeek)
                    ? p.ordersByWeek
                    : [];
                const daily = expandWeeklyOrdersToDays(orders, totalDays);
                for (let i = 0; i < totalDays; i++)
                    sums[i] += daily[i] ?? 0;
            });
            endgameAvgOrderPerDay = sums.map((s) => s / nPlayers);
        }
        else if (nextReveal % 5 === 0) {
            nextWeek = Math.min(weeks - 1, weekIndex + 1);
            nextStatus = "ordering";
        }
        else {
            nextStatus = "revealing";
        }
        const updatePayload = {
            revealedDemands,
            revealIndex: nextReveal,
            weekIndex: nextWeek,
            status: nextStatus,
            leaderboard: lbRows.slice(0, 50),
        };
        if (endgameAvgOrderPerDay) {
            updatePayload.endgameAvgOrderPerDay = endgameAvgOrderPerDay;
        }
        tx.update(sessionRef, updatePayload);
    });
    // Batch write player updates outside transaction (up to 500 per batch)
    const BATCH_SIZE = 500;
    for (let i = 0; i < playerUpdates.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = playerUpdates.slice(i, i + BATCH_SIZE);
        for (const { ref, dailyProfit, cumulativeProfit } of chunk) {
            batch.set(ref, {
                dailyProfit,
                cumulativeProfit,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
    }
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
    const privateRef = sessionRef.collection("private").doc("demand");
    // Collect player updates to batch write outside transaction
    const playerUpdates = [];
    await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists)
            throw new https_1.HttpsError("not-found", "Session not found.");
        const session = sessionSnap.data();
        const weeks = Math.round(Number(session?.weeks ?? 10));
        const totalDays = weeks * 5;
        const revealIndex = Math.max(0, Math.round(Number(session?.revealIndex ?? 0)));
        const privateSnap = await tx.get(privateRef);
        if (!privateSnap.exists)
            throw new https_1.HttpsError("not-found", "Private demand doc missing.");
        const inGame = privateSnap.data().inGameDemands;
        if (!Array.isArray(inGame) || inGame.length < totalDays) {
            throw new https_1.HttpsError("internal", "Invalid in-game demand series.");
        }
        const revealed = Array.isArray(session.revealedDemands) ? session.revealedDemands : [];
        const dayCount = Math.min(totalDays, revealed.length || revealIndex);
        const usedDemands = (revealed.length ? revealed : inGame.slice(0, revealIndex)).slice(0, dayCount);
        const price = Number(session.price ?? 1);
        const cost = Number(session.cost ?? 0.2);
        const salvage = Number(session.salvage ?? 0);
        const playersSnap = await tx.get(sessionRef.collection("players"));
        const lbRows = [];
        const sums = Array.from({ length: dayCount }, () => 0);
        // Calculate updates but don't write yet
        playersSnap.docs.forEach((pdoc) => {
            const p = pdoc.data();
            const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
            const orders = baseOrders.length === weeks
                ? baseOrders
                : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
            const dailyOrders = expandWeeklyOrdersToDays(orders, totalDays);
            const dailyProfit = [];
            let cumulativeProfit = 0;
            for (let i = 0; i < dayCount; i++) {
                const Q = Math.max(0, Math.round(Number(dailyOrders[i] ?? 0)));
                const D = usedDemands[i];
                const pf = (0, profit_1.profitForDay)(D, Q, price, cost, salvage);
                dailyProfit.push(pf);
                cumulativeProfit += pf;
                sums[i] += Q;
            }
            const submittedOrders = orders.filter((x) => typeof x === "number");
            const avgOrder = submittedOrders.length ? submittedOrders.reduce((a, b) => a + b, 0) / submittedOrders.length : 0;
            lbRows.push({
                uid: pdoc.id,
                name: String(p.name ?? "Anonymous"),
                profit: cumulativeProfit,
                avgOrder,
            });
            // Queue for batch write outside transaction
            playerUpdates.push({ ref: pdoc.ref, dailyProfit, cumulativeProfit });
        });
        lbRows.sort((a, b) => b.profit - a.profit);
        const nPlayers = playersSnap.docs.length || 1;
        const endgameAvgOrderPerDay = sums.map((s) => s / nPlayers);
        tx.update(sessionRef, {
            status: "finished",
            revealIndex: dayCount,
            weekIndex: Math.max(0, weeks - 1),
            revealedDemands: usedDemands,
            leaderboard: lbRows.slice(0, 50),
            endgameAvgOrderPerDay,
        });
    });
    // Batch write player updates outside transaction (up to 500 per batch)
    const BATCH_SIZE = 500;
    for (let i = 0; i < playerUpdates.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = playerUpdates.slice(i, i + BATCH_SIZE);
        for (const { ref, dailyProfit, cumulativeProfit } of chunk) {
            batch.set(ref, {
                dailyProfit,
                cumulativeProfit,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
    }
    return { ok: true };
});
exports.finishWeek = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.assertHost)(request);
    const sessionId = String(request.data?.sessionId ?? "");
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Missing sessionId.");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new https_1.HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data();
    const status = session.status;
    if (status !== "ordering" && status !== "training") {
        throw new https_1.HttpsError("failed-precondition", "Cannot finish week during revealing or after game ended.");
    }
    const weekIndex = Number(session.weekIndex ?? 0);
    const weeks = Math.round(Number(session.weeks ?? 10));
    const demandMu = Math.round(Number(session.demandMu ?? 50));
    // Get all players
    const playersSnap = await sessionRef.collection("players").get();
    // Find players who haven't submitted for this week
    const playersToUpdate = [];
    playersSnap.docs.forEach((pdoc) => {
        const p = pdoc.data();
        const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
        const orders = baseOrders.length === weeks
            ? [...baseOrders]
            : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
        // Check if this player hasn't submitted for the current week
        if (orders[weekIndex] === null || orders[weekIndex] === undefined) {
            orders[weekIndex] = demandMu;
            playersToUpdate.push({ ref: pdoc.ref, orders });
        }
    });
    if (playersToUpdate.length === 0) {
        return { ok: true, updated: 0, message: "All players have already submitted." };
    }
    // Batch update players who haven't submitted
    const BATCH_SIZE = 500;
    for (let i = 0; i < playersToUpdate.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = playersToUpdate.slice(i, i + BATCH_SIZE);
        for (const { ref, orders } of chunk) {
            batch.set(ref, {
                ordersByWeek: orders,
                submittedWeek: weekIndex,
                lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
    }
    // If session was in training status, move to ordering
    if (status === "training") {
        await sessionRef.update({ status: "ordering" });
    }
    return { ok: true, updated: playersToUpdate.length, defaultOrder: demandMu };
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
exports.cleanupOldSessions = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const snap = await db.collection("sessions").where("createdAt", "<", cutoff).get();
    const deletions = snap.docs.map(async (doc) => {
        const code = doc.data().code;
        await db.recursiveDelete(doc.ref);
        if (code) {
            await db.collection("sessionCodes").doc(String(code)).delete();
        }
    });
    await Promise.all(deletions);
});
