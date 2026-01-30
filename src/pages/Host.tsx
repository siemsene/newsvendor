import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuthState } from "../lib/useAuthState";
import type { SessionPublic } from "../lib/types";
import { Link } from "react-router-dom";

export function Host() {
  const { user, role } = useAuthState();

  const [params, setParams] = useState({
    demandMu: 50,
    demandSigma: 20,
    price: 1.0,
    cost: 0.2,
    salvage: 0.0,
    weeks: 10,
  });

  const [created, setCreated] = useState<{ sessionId: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [listMsg, setListMsg] = useState<string>("");

  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionPublic }>>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sessions"), where("createdByUid", "==", user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, data: d.data() as any }))
          .filter((row) => row.data?.status !== "finished")
          .sort((a, b) => {
            const aMs = (a.data.createdAt?.toMillis?.() ?? 0) as number;
            const bMs = (b.data.createdAt?.toMillis?.() ?? 0) as number;
            return bMs - aMs;
          });
        setSessions(rows);
        setListMsg("");
      },
      (err) => {
        console.error(err);
        setListMsg(err?.message ?? "Failed to load sessions.");
      }
    );
  }, [user]);

  async function createSession() {
    setMsg("");
    if (role !== "host") {
      setMsg("You are not recognized as host. Go to Home and log in with the host password.");
      return;
    }
    setBusy(true);
    try {
      const weeks = Math.max(1, Math.min(52, Math.round(Number(params.weeks ?? 10))));
      const res = await api.createSession({ ...params, weeks });
      setCreated(res.data);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Create session failed");
    } finally {
      setBusy(false);
    }
  }

  async function endSession(sessionId: string) {
    setListMsg("");
    setBusy(true);
    try {
      await api.endSession({ sessionId });
      setListMsg("Session ended.");
    } catch (e: any) {
      console.error(e);
      setListMsg(e?.message ?? "End session failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Create New Session</h2>
          {role === "host" && <span className="badge success">Host Mode</span>}
        </div>
        <p className="small">Configure demand distribution and pricing parameters for the game.</p>

        <div className="hr" />

        <h3>Demand Distribution</h3>
        <div className="grid two">
          <div>
            <label>Mean (μ)</label>
            <input
              type="number"
              value={params.demandMu}
              onChange={(e) => setParams((p) => ({ ...p, demandMu: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label>Std Deviation (σ)</label>
            <input
              type="number"
              value={params.demandSigma}
              onChange={(e) => setParams((p) => ({ ...p, demandSigma: Number(e.target.value) }))}
            />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Pricing</h3>
        <div className="grid three">
          <div>
            <label>Sales Price</label>
            <input type="number" step="0.01" value={params.price} onChange={(e) => setParams((p) => ({ ...p, price: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Unit Cost</label>
            <input type="number" step="0.01" value={params.cost} onChange={(e) => setParams((p) => ({ ...p, cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Salvage Value</label>
            <input type="number" step="0.01" value={params.salvage} onChange={(e) => setParams((p) => ({ ...p, salvage: Number(e.target.value) }))} />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Duration</h3>
        <div className="grid two">
          <div>
            <label>Weeks in Game</label>
            <input
              type="number"
              min={1}
              max={52}
              step={1}
              value={params.weeks}
              onChange={(e) => setParams((p) => ({ ...p, weeks: Math.max(1, Math.min(52, Math.round(Number(e.target.value)))) }))}
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <div className="small" style={{ padding: "12px 0" }}>
              = {params.weeks * 5} total days ({params.weeks} weeks × 5 days)
            </div>
          </div>
        </div>

        <div className="hr" />

        <div className="row">
          <button className={`btn${busy ? " loading" : ""}`} disabled={busy || role !== "host"} onClick={createSession}>
            Create Session
          </button>
          {role !== "host" && <span className="small text-danger">Login as host first.</span>}
        </div>

        {created && (
          <>
            <div className="hr" />
            <div className="card success-highlight" style={{ marginTop: 8 }}>
              <p style={{ margin: 0 }}>
                Session created! Share this code with players:
              </p>
              <div className="session-code" style={{ marginTop: 12 }}>{created.code}</div>
            </div>
          </>
        )}

        {msg && <div className="hr" />}
        {msg && <p className="text-danger">{msg}</p>}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Your Sessions</h2>
          <span className="badge">{sessions.length} active</span>
        </div>
        <p className="small">Click to open the host control room.</p>
        <div className="hr" />
        {listMsg && <p className="text-danger">{listMsg}</p>}
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <p className="small">No active sessions. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid">
            {sessions.map((s) => {
              const statusConfig: { label: string; dotClass: string } = {
                lobby: { label: "Lobby", dotClass: "pending" },
                training: { label: "Training", dotClass: "pending" },
                ordering: { label: "Ordering", dotClass: "active" },
                revealing: { label: "Revealing", dotClass: "active" },
                finished: { label: "Finished", dotClass: "finished" },
              }[s.data.status] ?? { label: s.data.status, dotClass: "pending" };
              return (
                <div key={s.id} className="player-card">
                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <span className="mono font-bold" style={{ fontSize: 16 }}>{s.data.code}</span>
                        <span className={`status-dot ${statusConfig.dotClass}`} />
                      </div>
                      <div className="small">
                        Week {(s.data.weekIndex ?? 0) + 1} of {s.data.weeks ?? 10} · {s.data.playersCount ?? 0} players
                      </div>
                    </div>
                    <div className="row">
                      <Link className="btn secondary" to={`/host/session/${s.id}`}>Open</Link>
                      <button
                        className="btn ghost"
                        disabled={busy || s.data.status === "finished"}
                        onClick={() => {
                          if (confirm("End this session for all players?")) {
                            endSession(s.id);
                          }
                        }}
                      >
                        End
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="hr" />
        <p className="small">
          Players join at the homepage using the session code.
        </p>
      </div>
    </div>
  );
}
