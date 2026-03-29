import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import type { PlayerDoc, SessionPublic } from "../lib/types";
import { TrainingChart } from "../components/TrainingChart";
import { mean, std } from "../lib/stats";
import { api } from "../lib/api";
import { RevealTheatre } from "../components/RevealTheatre";
import { Leaderboard } from "../components/Leaderboard";
import { EndgameCharts } from "../components/EndgameCharts";
import { useAuthState } from "../lib/useAuthState";
import { Toast } from "../components/Toast";
import { GuideDownloadButtons } from "../components/GuideDownloadButtons";

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
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string } | null>(null);
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const [asyncReveal, setAsyncReveal] = useState<{
    demands: number[];
    profits: number[];
    cumulativeProfit: number;
    finished: boolean;
    weekIndex: number;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const lastNudgeRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);
  const resumedTimerRef = useRef<number | null>(null);
  const submittedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let unsub: (() => void) | null = null;
    function subscribe() {
      unsub = onSnapshot(
        doc(db, "sessions", sessionId!),
        (snap) => { setSession(snap.exists() ? (snap.data() as any) : null); },
        (err) => { console.warn("Session listener error, resubscribing:", err); unsub?.(); setTimeout(subscribe, 2000); },
      );
    }
    subscribe();
    return () => { unsub?.(); };
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
      if (submittedTimerRef.current) window.clearTimeout(submittedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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

  // In async mode, accumulate revealed demands client-side as the player progresses.
  // Initializes from player.revealedDemands (Firestore) on load; grows after each submission.
  const [asyncAccDemands, setAsyncAccDemands] = useState<number[]>([]);

  useEffect(() => {
    if (!session?.asyncMode) return;
    const persisted = player?.revealedDemands;
    if (Array.isArray(persisted) && persisted.length > asyncAccDemands.length) {
      setAsyncAccDemands(persisted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.revealedDemands, session?.asyncMode]);

  useEffect(() => {
    if (!asyncReveal) return;
    const dpw = session?.daysPerWeek ?? 5;
    setAsyncAccDemands((prev) => {
      const expectedLen = (asyncReveal.weekIndex + 1) * dpw;
      if (prev.length < expectedLen) return [...prev, ...asyncReveal.demands];
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncReveal]);

  const training = session?.trainingDemands ?? [];
  const revealed = session?.asyncMode ? asyncAccDemands : (session?.revealedDemands ?? []);
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

  const weeks = session?.weeks ?? 10;
  const daysPerWeek = session?.daysPerWeek ?? 5;
  const asyncMode = session?.asyncMode === true;
  const asyncWeekIndex = asyncMode ? Math.floor((player?.dailyProfit?.length ?? 0) / daysPerWeek) : null;
  const asyncFinished = asyncMode && (player?.dailyProfit?.length ?? 0) >= weeks * daysPerWeek;
  const weekIndex = asyncWeekIndex !== null ? asyncWeekIndex : (session?.weekIndex ?? 0);
  const totalDays = (session?.trainingDemands?.length ?? 50) + weeks * daysPerWeek;
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

  useEffect(() => {
    setShowSubmitted(false);
    if (submittedTimerRef.current) window.clearTimeout(submittedTimerRef.current);
  }, [weekIndex, session?.status]);

  function showConfirm(title: string, body: string, qty: number) {
    setPendingQty(qty);
    setConfirmModal({ title, body });
  }

  async function submit(force?: boolean) {
    const allowForce = force === true;
    if (!sessionId || !session) return;
    if (!isOnline) {
      setMsg("You are offline. Please reconnect before submitting.");
      return;
    }
    setMsg("");
    setAsyncReveal(null);
    if (inputError) {
      setMsg("Order must be a non-negative integer.");
      return;
    }
    const q = orderQty.trim() === "" ? 0 : Number(orderQty);
    if (!allowForce) {
      if (q === 0) {
        showConfirm(
          "Bake nothing this week?",
          "You are about to submit an order of 0 croissants. You will earn nothing this week. Are you sure?",
          0,
        );
        return;
      }
      const prevOrder = weekIndex > 0 ? (player?.ordersByWeek?.[weekIndex - 1] ?? null) : null;
      if (prevOrder !== null && prevOrder > 0 && q > 2 * prevOrder) {
        showConfirm(
          "Unusually large order",
          `Your order (${q}) is more than twice your previous order (${prevOrder}). Are you sure?`,
          q,
        );
        return;
      }
      if (warningSigma > 0 && Math.abs(q - warningMean) > 4 * warningSigma) {
        showConfirm(
          "Outlier order",
          `Your order (${q}) is more than 4 standard deviations from the mean (${warningMean.toFixed(1)}). Are you sure?`,
          q,
        );
        return;
      }
    }
    setBusy(true);
    try {
      const submitQty = pendingQty ?? q;
      const res = await api.submitOrder({ sessionId, weekIndex, orderQty: submitQty });
      setMsg("");
      // Stamp this player's submission into the session doc so the real-time
      // tracker updates for all players without depending on Cloud Function counters.
      if (!asyncMode && user?.uid) {
        updateDoc(doc(db, "sessions", sessionId), {
          [`weekSubmissions.${user.uid}`]: weekIndex,
        }).catch(() => {/* non-critical */});
      }
      if (asyncMode && res.data.asyncReveal) {
        setAsyncReveal({ ...res.data.asyncReveal, weekIndex });
      } else {
        setShowSubmitted(true);
        if (submittedTimerRef.current) window.clearTimeout(submittedTimerRef.current);
        submittedTimerRef.current = window.setTimeout(() => setShowSubmitted(false), 4000);
      }
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
        <div className="row mb-12">
          <div>
            <div className="row mb-4">
              <h2 className="m-0">Welcome, {player.name}</h2>
              <span className="badge large mono">{session.code}</span>
            </div>
            <p className="small m-0">
              You run a croissant bakery. Each week, decide how many croissants to bake per day.
            </p>
          </div>
          <div className="spacer" />
          <div className="text-right">
            <div className="small">Your Profit</div>
            <div className={`mono font-bold profit-large ${profit >= 0 ? "text-success" : "text-danger"}`}>
              {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="pill">
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
        <div className="row mt-8">
          <GuideDownloadButtons role="player" />
        </div>
      </div>

      {session.status === "finished" ? (
        <div className="card success-highlight">
          <h2>Game Complete!</h2>
          <p>Congratulations on completing the Newsvendor simulation. Here are your final results:</p>
          <div className="kpi mt-16">
            <div className="pill success">
              Final Rank: <span className="mono font-bold">#{rank ?? "—"}</span>
            </div>
            <div className="pill accent">
              Total Profit: <span className="mono font-bold">{(player.cumulativeProfit ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : asyncFinished ? (
        <div className="card">
          <h2>All weeks submitted!</h2>
          <p className="small">
            You have completed all {weeks} weeks. Your total profit so far:{" "}
            <span className="mono font-bold">{(player.cumulativeProfit ?? 0).toFixed(2)}</span>.
            Waiting for your instructor to end the session and reveal the leaderboard.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="row mb-8">
            <h2 className="m-0">Weekly Bake Plan</h2>
            <span className="badge">Week {weekIndex + 1}/{weeks}</span>
          </div>
          <p className="small">
            Choose one quantity that applies to every day this week ({daysPerWeek} days). How many croissants will you bake per day?
          </p>
          <div className="row mt-10">
            <input
              type="number"
              title="Order quantity (croissants per day)"
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
              className="input-narrow"
            />
            <button className="btn" disabled={busy || submittedThisWeek !== null || !canSubmit || !isOnline} onClick={() => submit()}>
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

          {inputError && <p className="small text-danger">{inputError}</p>}

          {!asyncMode && session.playersCount != null && session.playersCount > 1 && (
            <div className="submission-tracker">
              {(() => {
                const total = session.playersCount!;
                const count = Object.values(session.weekSubmissions ?? {}).filter((w) => w === weekIndex).length;
                const remaining = total - count;
                const urgent = total > 5 && submittedThisWeek === null && remaining <= 2;
                return (
                  <>
                    <progress className={`submission-tracker-bar${urgent ? " urgent" : ""}`} value={count} max={total} />
                    <span className={`submission-tracker-label${urgent ? " urgent" : ""}`}>
                      {urgent
                        ? `⚠ Only ${remaining} player${remaining === 1 ? "" : "s"} left to submit — including you!`
                        : `${count} of ${total} players have submitted`}
                    </span>
                  </>
                );
              })()}
            </div>
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
          <TrainingChart demands={allDemands} meanHat={meanHat} sigmaHat={sigmaHat} totalDays={totalDays} trainingCount={training.length} daysPerWeek={daysPerWeek} />
        )}
        <RevealTheatre
          session={session}
          player={player}
          asyncRevealOverride={asyncReveal ? {
            demands: asyncReveal.demands,
            profits: asyncReveal.profits,
            weekIndex: asyncReveal.weekIndex,
            cumulativeProfit: asyncReveal.cumulativeProfit,
          } : undefined}
        />
      </div>

      {(session.status === "finished" || (!asyncMode && session.showLeaderboard)) && (
        <Leaderboard rows={session.leaderboard ?? []} />
      )}

      {session.status === "finished" && (
        <EndgameCharts session={session} avgOrderPerDayOverride={session.endgameAvgOrderPerDay} playerProfit={player.cumulativeProfit ?? null} />
      )}

      <Toast message="You are offline. Orders cannot be submitted until you reconnect." show={!isOnline} tone="alert" position="top" />
      <Toast message="Host nudge: please make your decision now." show={showNudge} tone="alert" />
      <Toast message="Welcome back! Your progress has been restored." show={showResumed} tone="success" />
      <Toast message="Bake plan submitted. Waiting for others..." show={showSubmitted} tone="success" position="top" />

      {confirmModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>{confirmModal.title}</h3>
            <p className="small">{confirmModal.body}</p>
            <div className="row end mt-12">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => { setConfirmModal(null); setPendingQty(null); }}
              >
                Revise
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => { setConfirmModal(null); submit(true); }}
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
