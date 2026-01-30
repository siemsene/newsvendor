import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const { user } = useAuthState();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [orderQty, setOrderQty] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inputError, setInputError] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [showResumed, setShowResumed] = useState(false);
  const [showOutlierModal, setShowOutlierModal] = useState(false);
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const lastNudgeRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);
  const resumedTimerRef = useRef<number | null>(null);

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
      if (resumedTimerRef.current) window.clearTimeout(resumedTimerRef.current);
    };
  }, []);

  // Show "welcome back" toast if player resumed their session
  useEffect(() => {
    const state = location.state as { resumed?: boolean } | null;
    if (state?.resumed) {
      setShowResumed(true);
      resumedTimerRef.current = window.setTimeout(() => setShowResumed(false), 4000);
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  const profit = player.cumulativeProfit ?? 0;

  return (
    <div className="grid">
      <div className="card highlight">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Welcome, {player.name}</h2>
              <span className="badge large mono">{session.code}</span>
            </div>
            <p className="small" style={{ margin: 0 }}>
              You run a croissant bakery. Each week, decide how many croissants to bake per day (Mon–Fri).
            </p>
          </div>
          <div className="spacer" />
          <div style={{ textAlign: "right" }}>
            <div className="small">Your Profit</div>
            <div className={`mono font-bold ${profit >= 0 ? "text-success" : "text-danger"}`} style={{ fontSize: 24 }}>
              {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="pill accent">
            Sell Price: <span className="mono">{session.price.toFixed(2)}</span>
          </div>
          <div className="pill">
            Cost: <span className="mono">{session.cost.toFixed(2)}</span>
          </div>
          <div className="pill">
            Salvage: <span className="mono">{session.salvage.toFixed(2)}</span>
          </div>
          {rank && (
            <div className="pill success">
              Rank: <span className="mono">#{rank}</span>
            </div>
          )}
        </div>
      </div>

      {session.status === "finished" ? (
        <div className="card success-highlight">
          <h2>Game Complete!</h2>
          <p>Congratulations on completing the Newsvendor simulation. Here are your final results:</p>
          <div className="kpi" style={{ marginTop: 16 }}>
            <div className="pill success">
              Final Rank: <span className="mono font-bold">#{rank ?? "—"}</span>
            </div>
            <div className="pill accent">
              Total Profit: <span className="mono font-bold">{(player.cumulativeProfit ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Weekly Bake Plan</h2>
            <span className="badge">Week {weekIndex + 1}/{weeks}</span>
          </div>
          <p className="small">
            Choose one quantity that applies to every day this week (Mon–Fri). How many croissants will you bake per day?
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

      {(session.status === "finished" || session.showLeaderboard) && (
        <Leaderboard rows={session.leaderboard ?? []} />
      )}

      {session.status === "finished" && (
        <EndgameCharts session={session} avgOrderPerDayOverride={session.endgameAvgOrderPerDay} />
      )}

      <Toast message="Host nudge: please make your decision now." show={showNudge} tone="alert" />
      <Toast message="Welcome back! Your progress has been restored." show={showResumed} tone="success" />

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
