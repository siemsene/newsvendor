import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { generateDemandDataset } from "./demand";
import { profitForDay } from "./profit";
import { assertHost } from "./auth";

admin.initializeApp();
const db = admin.firestore();
const hostPassword = defineSecret("HOST_PASSWORD");

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

function expandWeeklyOrdersToDays(ordersByWeek: Array<number | null>, totalDays: number) {
  const out: number[] = [];
  for (let i = 0; i < totalDays; i++) {
    const weekIndex = Math.floor(i / 5);
    const q = ordersByWeek[weekIndex];
    out.push(typeof q === "number" ? q : 0);
  }
  return out;
}

async function createSessionWithUniqueCode(payload: {
  uid: string;
  demandMu: number;
  demandSigma: number;
  price: number;
  cost: number;
  salvage: number;
  weeks: number;
  dataset: { training: number[]; inGame: number[]; optimalQ: number };
  seed: number;
  drawFailed: boolean;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeCode();
    const sessionRef = db.collection("sessions").doc();
    const privateRef = sessionRef.collection("private").doc("demand");
    const codeRef = db.collection("sessionCodes").doc(code);

    try {
      await db.runTransaction(async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists) {
          throw new HttpsError("already-exists", "Code collision.");
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
    } catch (e: any) {
      if (e?.code === "already-exists") continue;
      throw e;
    }
  }

  throw new HttpsError("internal", "Failed to generate unique session code.");
}

export const hostLogin = onCall({ secrets: [hostPassword] }, async (request) => {
  const uid = requireAuth(request);
  const password = (request.data?.password ?? "") as string;

  const secret = hostPassword.value();

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

  const seed = Math.floor(Math.random() * 2 ** 31);
  const nGame = weeks * 5;
  const dataset = generateDemandDataset(
    { mu: demandMu, sigma: demandSigma, nTrain: 50, nGame, price, cost, salvage },
    seed
  );
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

export const joinSession = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = String(request.data?.code ?? "").trim().toUpperCase();
  const name = String(request.data?.name ?? "").trim();

  if (!code) throw new HttpsError("invalid-argument", "Missing session code.");
  if (!name) throw new HttpsError("invalid-argument", "Missing name.");

  const snap = await db.collection("sessions").where("code", "==", code).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "Session code not found.");

  const sessionDoc = snap.docs[0];
  const sessionId = sessionDoc.id;
  const sessionRef = db.collection("sessions").doc(sessionId);

  const playerRef = sessionRef.collection("players").doc(uid);

  let resumed = false;

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data() as any;
    const weeks = Math.round(Number(session?.weeks ?? 10));

    const playerSnap = await tx.get(playerRef);

    // Check if this UID already has a player doc
    if (playerSnap.exists) {
      // Same UID rejoining - just update activity
      tx.set(
        playerRef,
        {
          name,
          isActive: true,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      resumed = true;
      return;
    }

    // Check for existing player with the same name (case-insensitive)
    const nameLower = name.toLowerCase();
    const nameRef = sessionRef.collection("names").doc(nameLower);
    const nameSnap = await tx.get(nameRef);

    if (nameSnap.exists) {
      const existingUid = nameSnap.data()?.uid;
      if (existingUid && existingUid !== uid) {
        // Name already taken by another UID
        throw new HttpsError("already-exists", "This name is already taken in this session.");
      }
    }

    const playerSnap = await tx.get(playerRef);

    // Check if this UID already has a player doc
    if (playerSnap.exists) {
      const oldPlayer = playerSnap.data() as any;
      // If name changed, we need to handle the old name doc if we wanted to be perfect, 
      // but for simplicity we just update the player and the new name doc.
      if (oldPlayer.name.toLowerCase() !== nameLower) {
        tx.delete(sessionRef.collection("names").doc(oldPlayer.name.toLowerCase()));
      }

      tx.set(
        playerRef,
        {
          name,
          isActive: true,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(nameRef, { uid });
      resumed = true;
      return;
    }

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
    tx.set(nameRef, { uid });
    tx.update(sessionRef, { playersCount: admin.firestore.FieldValue.increment(1) });
  });

  return { sessionId, resumed };
});

export const submitOrder = onCall(async (request) => {
  const uid = requireAuth(request);
  const sessionId = String(request.data?.sessionId ?? "");
  const weekIndex = Number(request.data?.weekIndex ?? 0);
  const orderQty = Math.max(0, Math.round(Number(request.data?.orderQty ?? 0)));

  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);

  const playerRef = sessionRef.collection("players").doc(uid);

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
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
  let nextReveal = 0;

  // Collect player updates to batch write outside transaction
  const playerUpdates: Array<{
    ref: admin.firestore.DocumentReference;
    dailyProfit: number[];
    cumulativeProfit: number;
  }> = [];

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data() as any;

    const revealIndex: number = session.revealIndex ?? 0;
    const weeks = Math.round(Number(session.weeks ?? 10));
    const totalDays = weeks * 5;
    if (revealIndex >= totalDays) throw new HttpsError("failed-precondition", "All days already revealed.");

    const privateSnap = await tx.get(privateRef);
    if (!privateSnap.exists) throw new HttpsError("not-found", "Private demand doc missing.");
    const inGame = (privateSnap.data() as any).inGameDemands as number[];
    if (!Array.isArray(inGame) || inGame.length < totalDays) {
      throw new HttpsError("internal", "Invalid in-game demand series.");
    }

    const D = inGame[revealIndex];
    const dayIndex = revealIndex;
    const weekIndex = Math.floor(dayIndex / 5);

    // Scaling fix: Advance reveal state immediately to "lock" it
    tx.update(sessionRef, { status: "revealing" });

    const playersSnap = await tx.get(sessionRef.collection("players"));

    const revealedDemands = Array.isArray(session.revealedDemands) ? session.revealedDemands.slice() : [];
    revealedDemands.push(D);

    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);

    const lbRows: Array<{ uid: string; name: string; profit: number; avgOrder: number }> = [];

    // Calculate updates but don't write yet
    playersSnap.docs.forEach((pdoc) => {
      const p = pdoc.data() as any;
      const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
      const orders: Array<number | null> = baseOrders.length === weeks ? baseOrders : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
      const Q = Math.max(0, Math.round(Number(orders[weekIndex] ?? 0)));

      const pf = profitForDay(D, Q, price, cost, salvage);

      const dailyProfit: number[] = Array.isArray(p.dailyProfit) ? p.dailyProfit.slice() : [];
      dailyProfit.push(pf);

      const cumulativeProfit = Number(p.cumulativeProfit ?? 0) + pf;

      // Queue for batch write outside transaction
      playerUpdates.push({ ref: pdoc.ref, dailyProfit, cumulativeProfit });

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

    nextReveal = revealIndex + 1;
    let nextStatus = String(session.status ?? "training");
    let nextWeek = Number(session.weekIndex ?? 0);

    let endgameAvgOrderPerDay: number[] | null = null;
    if (nextReveal === totalDays) {
      nextStatus = "finished";
      nextWeek = Math.max(0, weeks - 1);

      const playerDocs = playersSnap.docs;
      const nPlayers = playerDocs.length || 1;
      const sums = Array.from({ length: totalDays }, () => 0);
      playerDocs.forEach((pdoc) => {
        const p = pdoc.data() as any;
        const orders: Array<number | null> = Array.isArray(p.ordersByWeek)
          ? p.ordersByWeek
          : [];
        const daily = expandWeeklyOrdersToDays(orders, totalDays);
        for (let i = 0; i < totalDays; i++) sums[i] += daily[i] ?? 0;
      });
      endgameAvgOrderPerDay = sums.map((s) => s / nPlayers);
    } else if (nextReveal % 5 === 0) {
      nextWeek = Math.min(weeks - 1, weekIndex + 1);
      nextStatus = "ordering";
    } else {
      nextStatus = "revealing";
    }

    const updatePayload: Record<string, any> = {
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
      batch.set(
        ref,
        {
          dailyProfit,
          cumulativeProfit,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

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
  const privateRef = sessionRef.collection("private").doc("demand");

  // Collect player updates to batch write outside transaction
  const playerUpdates: Array<{
    ref: admin.firestore.DocumentReference;
    dailyProfit: number[];
    cumulativeProfit: number;
  }> = [];

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data() as any;
    const weeks = Math.round(Number(session?.weeks ?? 10));
    const totalDays = weeks * 5;
    const revealIndex = Math.max(0, Math.round(Number(session?.revealIndex ?? 0)));

    const privateSnap = await tx.get(privateRef);
    if (!privateSnap.exists) throw new HttpsError("not-found", "Private demand doc missing.");
    const inGame = (privateSnap.data() as any).inGameDemands as number[];
    if (!Array.isArray(inGame) || inGame.length < totalDays) {
      throw new HttpsError("internal", "Invalid in-game demand series.");
    }

    const revealed = Array.isArray(session.revealedDemands) ? session.revealedDemands : [];
    const dayCount = Math.min(totalDays, revealed.length || revealIndex);
    const usedDemands = (revealed.length ? revealed : inGame.slice(0, revealIndex)).slice(0, dayCount);

    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);

    const playersSnap = await tx.get(sessionRef.collection("players"));
    const lbRows: Array<{ uid: string; name: string; profit: number; avgOrder: number }> = [];
    const sums = Array.from({ length: dayCount }, () => 0);

    // Calculate updates but don't write yet
    playersSnap.docs.forEach((pdoc) => {
      const p = pdoc.data() as any;
      const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
      const orders: Array<number | null> = baseOrders.length === weeks
        ? baseOrders
        : Array.from({ length: weeks }, (_, i) => baseOrders[i] ?? null);
      const dailyOrders = expandWeeklyOrdersToDays(orders, totalDays);
      const dailyProfit: number[] = [];
      let cumulativeProfit = 0;
      for (let i = 0; i < dayCount; i++) {
        const Q = Math.max(0, Math.round(Number(dailyOrders[i] ?? 0)));
        const D = usedDemands[i];
        const pf = profitForDay(D, Q, price, cost, salvage);
        dailyProfit.push(pf);
        cumulativeProfit += pf;
        sums[i] += Q;
      }

      const submittedOrders = orders.filter((x) => typeof x === "number") as number[];
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
      batch.set(
        ref,
        {
          dailyProfit,
          cumulativeProfit,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return { ok: true };
});

export const finishWeek = onCall(async (request) => {
  await assertHost(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing sessionId.");

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");

  const session = sessionSnap.data() as any;
  const status = session.status;
  if (status !== "ordering" && status !== "training" && status !== "revealing") {
    throw new HttpsError("failed-precondition", "Cannot finish week after game ended.");
  }

  const weekIndex = Number(session.weekIndex ?? 0);
  const weeks = Math.round(Number(session.weeks ?? 10));
  const demandMu = Math.round(Number(session.demandMu ?? 50));

  // Get all players
  const playersSnap = await sessionRef.collection("players").get();

  // Find players who haven't submitted for this week
  const playersToUpdate: Array<{
    ref: admin.firestore.DocumentReference;
    orders: Array<number | null>;
  }> = [];

  playersSnap.docs.forEach((pdoc) => {
    const p = pdoc.data() as any;
    const baseOrders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
    const orders: Array<number | null> = baseOrders.length === weeks
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
      batch.set(
        ref,
        {
          ordersByWeek: orders,
          submittedWeek: weekIndex,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  // If session was in training status, move to ordering
  if (status === "training") {
    await sessionRef.update({ status: "ordering" });
  }

  return { ok: true, updated: playersToUpdate.length, defaultOrder: demandMu };
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

export const cleanupOldSessions = onSchedule("every 24 hours", async () => {
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
