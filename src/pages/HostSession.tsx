import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import type { PlayerDoc, SessionPublic } from "../lib/types";
import { api } from "../lib/api";
import { Leaderboard } from "../components/Leaderboard";
import { EndgameCharts } from "../components/EndgameCharts";

export function HostSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
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
    });
    return () => {
      unsubS();
      unsubP();
    };
  }, [sessionId]);

  const weekIndex = session?.weekIndex ?? 0;
  const submitted = useMemo(() => {
    return players.filter((p) => (p.ordersByWeek?.[weekIndex] ?? null) !== null);
  }, [players, weekIndex]);

  async function advance() {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      const res = await api.advanceReveal({ sessionId });
      setMsg(`Revealed day ${res.data.revealIndex}/50`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Advance reveal failed");
    } finally {
      setBusy(false);
    }
  }

  async function nudge(uid: string) {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      await api.nudgePlayer({ sessionId, uid });
      setMsg("Nudge sent.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Nudge failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="card">
        <h2>Host control room</h2>
        <p className="small">Loading session…</p>
      </div>
    );
  }

  const allSubmitted = players.length > 0 && submitted.length === players.length;

  return (
    <div className="grid">
      <div className="card">
        <h2>Host control room</h2>
        <p className="small">
          Session code: <span className="badge mono">{session.code}</span> · Status:{" "}
          <span className="mono">{session.status}</span>
        </p>

        <div className="kpi" style={{ marginTop: 10 }}>
          <div className="pill">
            Week: <span className="mono">{weekIndex + 1}/10</span>
          </div>
          <div className="pill">
            Revealed days: <span className="mono">{session.revealIndex}/50</span>
          </div>
          <div className="pill">
            Optimal Q*: <span className="mono">{session.optimalQ}</span>
          </div>
        </div>

        <div className="hr" />

        <div className="row">
          <button className="btn" disabled={busy} onClick={advance}>
            Reveal next day 🎭
          </button>
          <div className="spacer" />
          <span className="small">
            Submitted this week: <span className="mono">{submitted.length}/{players.length}</span>{" "}
            {allSubmitted ? "✅" : ""}
          </span>
        </div>

        {msg && <div className="hr" />}
        {msg && <p className="small">{msg}</p>}
      </div>

      <div className="card">
        <h2>Roster</h2>
        <p className="small">Nudge bakers who haven’t submitted their weekly bake plan.</p>
        <div className="hr" />
        {players.length === 0 ? (
          <p className="small">No players yet.</p>
        ) : (
          <div className="grid">
            {players.map((p) => {
              const has = (p.ordersByWeek?.[weekIndex] ?? null) !== null;
              return (
                <div
                  key={p.uid}
                  className="card"
                  style={{ padding: 14, background: "rgba(255,255,255,0.75)" }}
                >
                  <div className="row">
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div className="small">
                        Week {weekIndex + 1} order:{" "}
                        <span className="mono">{has ? p.ordersByWeek?.[weekIndex] : "—"}</span>
                        {" · "}
                        Profit: <span className="mono">{(p.cumulativeProfit ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="spacer" />
                    <button className="btn ghost" disabled={busy || has} onClick={() => nudge(p.uid)}>
                      Nudge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Leaderboard players={players} />

      {session.status === "finished" && <EndgameCharts session={session} players={players} />}
    </div>
  );
}
