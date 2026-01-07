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
        <h2>Create a new session</h2>
        <p>Set demand parameters and cost parameters. A unique demand dataset is generated per session.</p>

        <div className="grid two">
          <div>
            <label>Demand mean (μ)</label>
            <input
              type="number"
              value={params.demandMu}
              onChange={(e) => setParams((p) => ({ ...p, demandMu: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label>Demand std dev (σ)</label>
            <input
              type="number"
              value={params.demandSigma}
              onChange={(e) => setParams((p) => ({ ...p, demandSigma: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="grid three">
          <div>
            <label>Sales price</label>
            <input type="number" step="0.01" value={params.price} onChange={(e) => setParams((p) => ({ ...p, price: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Purchase cost</label>
            <input type="number" step="0.01" value={params.cost} onChange={(e) => setParams((p) => ({ ...p, cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Salvage value</label>
            <input type="number" step="0.01" value={params.salvage} onChange={(e) => setParams((p) => ({ ...p, salvage: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="grid two">
          <div>
            <label>Weeks in game</label>
            <input
              type="number"
              min={1}
              max={52}
              step={1}
              value={params.weeks}
              onChange={(e) => setParams((p) => ({ ...p, weeks: Math.max(1, Math.min(52, Math.round(Number(e.target.value)))) }))}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy} onClick={createSession}>
            Create session
          </button>
          <span className="small">{role === "host" ? "Host mode enabled." : "Not host yet."}</span>
        </div>

        {created && (
          <>
            <div className="hr" />
            <p>
              Session created! Code: <span className="badge mono">{created.code}</span>
            </p>
          </>
        )}

        {msg && <div className="hr" />}
        {msg && <p style={{ color: "#7a2d2d" }}>{msg}</p>}
      </div>

      <div className="card">
        <h2>Your sessions</h2>
        <p className="small">Click to open the host control room.</p>
        <div className="hr" />
        {listMsg && <p style={{ color: "#7a2d2d" }}>{listMsg}</p>}
        {sessions.length === 0 ? (
          <p className="small">No sessions yet.</p>
        ) : (
          <div className="grid">
            {sessions.map((s) => (
              <div key={s.id} className="card" style={{ padding: 14, background: "rgba(255,255,255,0.75)" }}>
                <div className="row">
                  <div>
                    <div style={{ fontWeight: 800 }}>Code: <span className="mono">{s.data.code}</span></div>
                    <div className="small">Week: <span className="mono">{(s.data.weekIndex ?? 0) + 1}</span></div>
                  </div>
                  <div className="spacer" />
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
            ))}
          </div>
        )}
        <div className="hr" />
        <p className="small">
          Players join on Home with the session code.
        </p>
      </div>
    </div>
  );
}
