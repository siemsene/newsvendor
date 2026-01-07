import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { generateDemandDataset } from "./demand";
import { profitForDay } from "./profit";
import { assertHost } from "./auth";

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "us-central1" });

function requireAuth(context: any) {
  if (!context.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  return context.auth.uid as string;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const hostLogin = onCall(async (request) => {
  const uid = requireAuth(request);
  const password = (request.data?.password ?? "") as string;

  const secret = process.env.HOST_PASSWORD;

  if (!secret) {
    if (password !== "Sesame") {
      throw new HttpsError("permission-denied", "Wrong host password.");
    }
  } else if (password !== secret) {
    throw new HttpsError("permission-denied", "Wrong host password.");
  }

  await admin.auth().setCustomUserClaims(uid, { role: "host" });
  return { ok: true };
});

export const createSession = onCall(async (request) => {
  const uid = requireAuth(request);
  await assertHost(request);

  const demandMu = Number(request.data?.demandMu ?? 50);
  const demandSigma = Number(request.data?.demandSigma ?? 20);
  const price = Number(request.data?.price ?? 1.0);
  const cost = Number(request.data?.cost ?? 0.2);
  const salvage = Number(request.data?.salvage ?? 0.0);
  const weeks = Math.round(Number(request.data?.weeks ?? 10));

  if (!(demandSigma > 0)) throw new HttpsError("invalid-argument", "demandSigma must be > 0");
  if (!(price > 0)) throw new HttpsError("invalid-argument", "price must be > 0");
  if (!(weeks >= 1 && weeks <= 52)) throw new HttpsError("invalid-argument", "weeks must be between 1 and 52");

  const code = makeCode();
  const sessionRef = db.collection("sessions").doc();
  const sessionId = sessionRef.id;

  const seed = Math.floor(Math.random() * 2 ** 31);
  const nGame = weeks * 5;
  const dataset = generateDemandDataset(
    { mu: demandMu, sigma: demandSigma, nTrain: 50, nGame, price, cost, salvage },
    seed
  );
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

export const joinSession = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = String(request.data?.code ?? "").trim().toUpperCase();
  const name = String(request.data?.name ?? "").trim();

  if (!code) throw new HttpsError("invalid-argument", "Missing session code.");
  if (!name) throw new HttpsError("invalid-argument", "Missing name.");

  const snap = await db.collection("sessions").where("code", "==", code).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "Session code not found.");

  const sessionDoc = snap.docs[0];
  const session = sessionDoc.data() as any;
  const weeks = Math.round(Number(session?.weeks ?? 10));
  const sessionId = sessionDoc.id;

  const playerRef = db.collection("sessions").doc(sessionId).collection("players").doc(uid);

  await playerRef.set(
    {
      name,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      ordersByWeek: Array.from({ length: Math.max(1, weeks) }, () => null),
      dailyProfit: [],
      cumulativeProfit: 0,
      submittedWeek: null,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      lastNudgedAt: null,
    },
    { merge: true }
  );

  return { sessionId };
});

export const submitOrder = onCall(async (request) => {
  const uid = requireAuth(request);
  const sessionId = String(request.data?.sessionId ?? "");
  const weekIndex = Number(request.data?.weekIndex ?? 0);
  const orderQty = Math.max(0, Math.round(Number(request.data?.orderQty ?? 0)));

  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
  const session = sessionSnap.data() as any;
  const weeks = Math.round(Number(session.weeks ?? 10));

  if (!(weekIndex >= 0 && weekIndex < weeks)) throw new HttpsError("invalid-argument", "Invalid weekIndex.");

  if (!["training", "ordering"].includes(session.status)) {
    throw new HttpsError("failed-precondition", "Not accepting orders right now.");
  }
  if (session.weekIndex !== weekIndex) {
    throw new HttpsError("failed-precondition", `Week mismatch. Current week is ${session.weekIndex}.`);
  }

  const playerRef = sessionRef.collection("players").doc(uid);

  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(playerRef);
    if (!pSnap.exists) throw new HttpsError("not-found", "Player doc not found. Join session first.");
    const p = pSnap.data() as any;

    const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
    const orders = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
    orders[weekIndex] = orderQty;

    tx.set(
      playerRef,
      {
        ordersByWeek: orders,
        submittedWeek: weekIndex,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (session.status === "training") {
      tx.update(sessionRef, { status: "ordering" });
    }
  });

  return { ok: true };
});

export const nudgePlayer = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  const targetUid = String(request.data?.uid ?? "");
  if (!sessionId || !targetUid) throw new HttpsError("invalid-argument", "Missing args.");

  const ref = db.collection("sessions").doc(sessionId).collection("players").doc(targetUid);
  await ref.set({ lastNudgedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  await db.collection("sessions").doc(sessionId).collection("events").add({
    type: "nudge",
    uid: targetUid,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const advanceReveal = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const privateRef = sessionRef.collection("private").doc("demand");

  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
  const session = sessionSnap.data() as any;

  const revealIndex: number = session.revealIndex ?? 0;
  const weeks = Math.round(Number(session.weeks ?? 10));
  const totalDays = weeks * 5;
  if (revealIndex >= totalDays) throw new HttpsError("failed-precondition", "All days already revealed.");

  const privateSnap = await privateRef.get();
  if (!privateSnap.exists) throw new HttpsError("not-found", "Private demand doc missing.");
  const inGame = (privateSnap.data() as any).inGameDemands as number[];
  if (!Array.isArray(inGame) || inGame.length < totalDays) {
    throw new HttpsError("internal", "Invalid in-game demand series.");
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

  const lbRows: Array<{ uid: string; name: string; profit: number; avgOrder: number }> = [];

  playersSnap.docs.forEach((pdoc) => {
    const p = pdoc.data() as any;
    const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
    const orders: Array<number | null> = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
    const Q = Math.max(0, Math.round(Number(orders[weekIndex] ?? 0)));

    const pf = profitForDay(D, Q, price, cost, salvage);

    const dailyProfit: number[] = Array.isArray(p.dailyProfit) ? p.dailyProfit.slice() : [];
    dailyProfit.push(pf);

    const cumulativeProfit = Number(p.cumulativeProfit ?? 0) + pf;

    batch.set(
      pdoc.ref,
      {
        dailyProfit,
        cumulativeProfit,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const submittedOrders = orders.filter((x) => typeof x === "number") as number[];
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
  } else if (nextReveal % 5 === 0) {
    nextWeek = Math.min(weeks - 1, weekIndex + 1);
    nextStatus = "ordering";
  } else {
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

export const startSession = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
  const session = sessionSnap.data() as any;

  if (session.status !== "training") {
    throw new HttpsError("failed-precondition", "Session already started.");
  }

  await sessionRef.update({
    status: "ordering",
    weekIndex: 0,
    revealIndex: 0,
  });

  return { ok: true };
});

export const redrawSession = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
  const session = sessionSnap.data() as any;

  if (session.status !== "training") {
    throw new HttpsError("failed-precondition", "Session already started.");
  }

  const seed = Math.floor(Math.random() * 2 ** 31);
  const weeks = Math.round(Number(session.weeks ?? 10));
  const dataset = generateDemandDataset(
    {
      mu: Number(session.demandMu ?? 50),
      sigma: Number(session.demandSigma ?? 20),
      nTrain: 50,
      nGame: weeks * 5,
      price: Number(session.price ?? 1.0),
      cost: Number(session.cost ?? 0.2),
      salvage: Number(session.salvage ?? 0.0),
    },
    seed
  );
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

export const endSession = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
  const session = sessionSnap.data() as any;
  const weeks = Math.round(Number(session?.weeks ?? 10));
  const totalDays = weeks * 5;

  await sessionRef.update({
    status: "finished",
    revealIndex: totalDays,
    weekIndex: Math.max(0, weeks - 1),
  });

  return { ok: true };
});

export const kickPlayer = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  const uid = String(request.data?.uid ?? "");
  if (!sessionId || !uid) throw new HttpsError("invalid-argument", "Missing args.");

  const playerRef = db.collection("sessions").doc(sessionId).collection("players").doc(uid);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw new HttpsError("not-found", "Player not found.");

  await playerRef.delete();
  return { ok: true };
});
