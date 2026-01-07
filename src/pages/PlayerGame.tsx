import React, { useEffect, useMemo, useState } from "react";
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

export function PlayerGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuthState();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [orderQty, setOrderQty] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inputError, setInputError] = useState("");

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


  const training = session?.trainingDemands ?? [];
  const revealed = session?.revealedDemands ?? [];
  const allDemands = useMemo(() => training.concat(revealed), [training, revealed]);
  const meanHat = useMemo(() => mean(allDemands), [allDemands]);
  const sigmaHat = useMemo(() => std(allDemands), [allDemands]);

  const weekIndex = session?.weekIndex ?? 0;
  const weeks = session?.weeks ?? 10;
  const totalDays = (session?.trainingDemands?.length ?? 50) + weeks * 5;
  const submittedThisWeek = player?.ordersByWeek?.[weekIndex] ?? null;
  const canSubmit = session?.status !== "training";

  async function submit() {
    if (!sessionId || !session) return;
    setMsg("");
    if (inputError || orderQty.trim() === "") {
      setMsg("Order must be a non-negative integer.");
      return;
    }
    setBusy(true);
    try {
      const q = Number(orderQty);
      await api.submitOrder({ sessionId, weekIndex, orderQty: q });
      setMsg("");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
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

      <div className="card">
        <h2>Weekly bake plan</h2>
        <p className="small">
          Week {weekIndex + 1}/{weeks} · one quantity applies to every day this week. How many croissants will you bake per day this week?
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
          <button className="btn" disabled={busy || submittedThisWeek !== null || !canSubmit} onClick={submit}>
            {submittedThisWeek !== null ? "Submitted ✅" : "Submit bake plan"}
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

      {(session.status === "finished" || session.showLeaderboard) && (
        <Leaderboard rows={session.leaderboard ?? []} />
      )}

      {session.status === "finished" && (
        <EndgameCharts session={session} avgOrderPerDayOverride={session.endgameAvgOrderPerDay} />
      )}
    </div>
  );
}
