import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";
import type { PlayerDoc, SessionPublic } from "../lib/types";
import { TrainingChart } from "../components/TrainingChart";
import { mean, std } from "../lib/stats";
import { api } from "../lib/api";
import { RevealTheatre } from "../components/RevealTheatre";
import { Leaderboard } from "../components/Leaderboard";
import { EndgameCharts } from "../components/EndgameCharts";

export function PlayerGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [orderQty, setOrderQty] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    const unsubS = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      setSession(snap.exists() ? (snap.data() as any) : null);
    });
    const unsubP = onSnapshot(collection(db, "sessions", sessionId, "players"), (snap) => {
      const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })) as any;
      setPlayers(rows);
      const me = rows.find((r: any) => r.uid === auth.currentUser?.uid) ?? null;
      setPlayer(me);
    });
    return () => {
      unsubS();
      unsubP();
    };
  }, [sessionId]);

  useEffect(() => {
    const q = session?.optimalQ;
    if (typeof q === "number") setOrderQty(q);
  }, [session?.optimalQ]);

  const training = session?.trainingDemands ?? [];
  const meanHat = useMemo(() => mean(training), [training]);
  const sigmaHat = useMemo(() => std(training), [training]);

  const weekIndex = session?.weekIndex ?? 0;
  const submittedThisWeek = player?.ordersByWeek?.[weekIndex] ?? null;

  async function submit() {
    if (!sessionId || !session) return;
    setMsg("");
    setBusy(true);
    try {
      const q = Math.max(0, Math.round(orderQty));
      await api.submitOrder({ sessionId, weekIndex, orderQty: q });
      setMsg("Bake plan submitted. Waiting for others…");
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
          <div className="pill">
            Optimal Q*: <span className="mono">{session.optimalQ}</span>
          </div>
        </div>
      </div>

      <TrainingChart demands={training} meanHat={meanHat} sigmaHat={sigmaHat} />

      <div className="card">
        <h2>Weekly bake plan</h2>
        <p className="small">
          Week {weekIndex + 1}/10 · one quantity applies to every day this week.
        </p>

        <label>How many croissants will you bake per day this week?</label>
        <input type="number" value={orderQty} onChange={(e) => setOrderQty(Number(e.target.value))} min={0} step={1} />

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || submittedThisWeek !== null} onClick={submit}>
            {submittedThisWeek !== null ? "Submitted ✅" : "Submit bake plan"}
          </button>
          <span className="small">
            {submittedThisWeek !== null ? `Your submitted Q: ${submittedThisWeek}` : "Tip: start near μ̂ + safety stock."}
          </span>
        </div>

        {msg && <div className="hr" />}
        {msg && <p className="small">{msg}</p>}
      </div>

      <RevealTheatre session={session} player={player} />

      <Leaderboard players={players} />

      {session.status === "finished" && <EndgameCharts session={session} players={players} />}
    </div>
  );
}
