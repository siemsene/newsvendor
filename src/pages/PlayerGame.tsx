import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { PlayerDoc, SessionPublic } from "../lib/types";
import { TrainingChart } from "../components/TrainingChart";
import { mean, std } from "../lib/stats";
import { api } from "../lib/api";
import { RevealTheatre } from "../components/RevealTheatre";
import { Leaderboard } from "../components/Leaderboard";
import { EndgameCharts } from "../components/EndgameCharts";
import { useAuthState } from "../lib/useAuthState";
import { Toast } from "../components/Toast";

export function PlayerGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuthState();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [orderQty, setOrderQty] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inputError, setInputError] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [showOutlierModal, setShowOutlierModal] = useState(false);
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const lastNudgeRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const unsubS = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      setSession(snap.exists() ? (snap.data() as any) : null);
    });
    return () => {
      unsubS();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user?.uid) return;
    const unsub = onSnapshot(doc(db, "sessions", sessionId, "players", user.uid), (snap) => {
      if (!snap.exists()) {
        setPlayer(null);
        return;
      }
      setPlayer({ uid: user.uid, ...(snap.data() as any) });
    });
    return () => unsub();
  }, [sessionId, user?.uid]);

  useEffect(() => {
    if (!player?.lastNudgedAt) return;
    const stamp = (() => {
      if (typeof player.lastNudgedAt?.toMillis === "function") return player.lastNudgedAt.toMillis();
      const dt = player.lastNudgedAt instanceof Date ? player.lastNudgedAt : new Date(player.lastNudgedAt);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : null;
    })();
    if (!stamp) return;
    if (lastNudgeRef.current !== null && stamp > lastNudgeRef.current) {
      setShowNudge(true);
      if (nudgeTimerRef.current) window.clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = window.setTimeout(() => setShowNudge(false), 4200);
    }
    lastNudgeRef.current = stamp;
  }, [player?.lastNudgedAt]);

  useEffect(() => {
    return () => {
      if (nudgeTimerRef.current) window.clearTimeout(nudgeTimerRef.current);
    };
  }, []);


  const training = session?.trainingDemands ?? [];
  const revealed = session?.revealedDemands ?? [];
  const allDemands = useMemo(() => training.concat(revealed), [training, revealed]);
  const meanHat = useMemo(() => mean(allDemands), [allDemands]);
  const sigmaHat = useMemo(() => std(allDemands), [allDemands]);
  const warningMean = useMemo(() => {
    const mu = Number(session?.demandMu);
    if (Number.isFinite(mu)) return mu;
    return training.length ? mean(training) : meanHat;
  }, [session?.demandMu, training, meanHat]);
  const warningSigma = useMemo(() => {
    const sigma = Number(session?.demandSigma);
    if (Number.isFinite(sigma) && sigma > 0) return sigma;
    if (training.length) {
      const s = std(training);
      if (s > 0) return s;
    }
    const s = std(allDemands);
    return s > 0 ? s : 0;
  }, [session?.demandSigma, training, allDemands]);

  const weekIndex = session?.weekIndex ?? 0;
  const weeks = session?.weeks ?? 10;
  const totalDays = (session?.trainingDemands?.length ?? 50) + weeks * 5;
  const submittedThisWeek = player?.ordersByWeek?.[weekIndex] ?? null;
  const canSubmit = session?.status !== "training";
  const rank = useMemo(() => {
    const rows = session?.leaderboard ?? [];
    const idx = rows.findIndex((r) => r.uid === player?.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [session?.leaderboard, player?.uid]);

  useEffect(() => {
    setOrderQty("");
    setInputError("");
  }, [weekIndex]);

  async function submit(force?: boolean) {
    const allowForce = force === true;
    if (!sessionId || !session) return;
    setMsg("");
    if (inputError || orderQty.trim() === "") {
      setMsg("Order must be a non-negative integer.");
      return;
    }
    const q = Number(orderQty);
    if (!allowForce && warningSigma > 0 && Math.abs(q - warningMean) > 4 * warningSigma) {
      setPendingQty(q);
      setShowOutlierModal(true);
      return;
    }
    setBusy(true);
    try {
      const submitQty = pendingQty ?? q;
      await api.submitOrder({ sessionId, weekIndex, orderQty: submitQty });
      setMsg("");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
      setPendingQty(null);
    }
  }

  if (!session) {
    return (
      <div className="card">
        <h2>Bakery floor</h2>
        <p className="small">Loading session…</p>
      </div>
    );
  }
  if (!player) {
    return (
      <div className="card">
        <h2>Bakery floor</h2>
        <p className="small">Waiting for your player profile… (did you join with a name?)</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>
          Session: <span className="badge mono">{session.code}</span>
        </h2>
        <p className="small">
          You run a croissant bakery. Each week, choose how many croissants to bake per day (Mon–Fri).
          Unsold croissants salvage at <span className="mono">{session.salvage.toFixed(2)}</span>.
        </p>
        <p className="small">
          Player: <span className="mono">{player.name}</span>
        </p>
        <div className="kpi">
          <div className="pill">
            Price: <span className="mono">{session.price.toFixed(2)}</span>
          </div>
          <div className="pill">
            Cost: <span className="mono">{session.cost.toFixed(2)}</span>
          </div>
          <div className="pill">
            Salvage: <span className="mono">{session.salvage.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid two">
        {session.status === "training" ? (
          <div className="card">
            <h2>Demand distribution</h2>
            <p className="small">Available once the host starts the session.</p>
          </div>
        ) : (
          <TrainingChart demands={allDemands} meanHat={meanHat} sigmaHat={sigmaHat} totalDays={totalDays} />
        )}
        <RevealTheatre session={session} player={player} />
      </div>

      {session.status === "finished" ? (
        <div className="card">
          <h2>Game ended</h2>
          <p className="small">This session has ended. Thanks for playing!</p>
          <div className="kpi" style={{ marginTop: 10 }}>
            <div className="pill">
              Your rank: <span className="mono">{rank ?? "—"}</span>
            </div>
            <div className="pill">
              Total profit: <span className="mono">{(player.cumulativeProfit ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Weekly bake plan</h2>
          <p className="small">
            Week {weekIndex + 1}/{weeks} - one quantity applies to every day this week. How many croissants will you bake per day this week?
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              type="number"
              value={orderQty}
              onChange={(e) => {
                const value = e.target.value;
                setOrderQty(value);
                if (value.trim() === "") {
                  setInputError("");
                  return;
                }
                const num = Number(value);
                if (!Number.isInteger(num) || num < 0) {
                  setInputError("Order must be a non-negative integer.");
                } else {
                  setInputError("");
                }
              }}
              min={0}
              step={1}
              style={{ maxWidth: 120 }}
            />
            <button className="btn" disabled={busy || submittedThisWeek !== null || !canSubmit} onClick={() => submit()}>
              {submittedThisWeek !== null ? "Submitted ✔" : "Submit bake plan"}
            </button>
            <span className="small">
              {submittedThisWeek !== null
                ? `Your submitted Q: ${submittedThisWeek}`
                : canSubmit
                  ? ""
                  : "Waiting for host to start the session."}
            </span>
          </div>

          {inputError && <p className="small" style={{ color: "#7a2d2d" }}>{inputError}</p>}
          {submittedThisWeek !== null && (
            <p className="small">Bake plan submitted. Waiting for others...</p>
          )}
          {msg && <div className="hr" />}
          {msg && <p className="small">{msg}</p>}
        </div>
      )}

      {(session.status === "finished" || session.showLeaderboard) && (
        <Leaderboard rows={session.leaderboard ?? []} />
      )}

      {session.status === "finished" && (
        <EndgameCharts session={session} avgOrderPerDayOverride={session.endgameAvgOrderPerDay} />
      )}

      <Toast message="Host nudge: please make your decision now." show={showNudge} tone="alert" />

      {showOutlierModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Confirm outlier order</h3>
            <p className="small">
              Your order ({pendingQty ?? "?"}) is more than 4 standard deviations from the mean ({warningMean.toFixed(2)}).
              Are you sure you want to submit it?
            </p>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  setShowOutlierModal(false);
                  setPendingQty(null);
                }}
              >
                Revise
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setShowOutlierModal(false);
                  submit(true);
                }}
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
