import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuthState } from "../lib/useAuthState";
import type { SessionPublic } from "../lib/types";
import { Link, useNavigate } from "react-router-dom";
import { probit } from "../lib/stats";
import { GuideDownloadButtons } from "../components/GuideDownloadButtons";

export function Host() {
  const { user, isApprovedInstructor, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [params, setParams] = useState({
    demandMu: 100,
    demandSigma: 40,
    price: 4,
    cost: 0.5,
    salvage: 0,
    weeks: 10,
    daysPerWeek: 5,
    asyncMode: false,
    noDragons: false,
  });

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
    if (!isApprovedInstructor) {
      setMsg("You need to be an approved instructor to create sessions.");
      return;
    }
    setBusy(true);
    try {
      const weeks = Math.max(1, Math.min(52, Math.round(Number(params.weeks ?? 10))));
      const res = await api.createSession({ ...params, weeks });
      navigate(`/host/session/${res.data.sessionId}`);
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

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this finished session? This cannot be undone.")) return;
    setListMsg("");
    setBusy(true);
    try {
      await api.deleteSession({ sessionId });
      setListMsg("Session deleted.");
    } catch (e: any) {
      console.error(e);
      setListMsg(e?.message ?? "Delete session failed");
    } finally {
      setBusy(false);
    }
  }

  const activeSessions = sessions.filter((s) => s.data?.status !== "finished");
  const finishedSessions = sessions.filter((s) => s.data?.status === "finished");

  return (
    <div className="grid two">
      <div className="card">
        <div className="row mb-12">
          <h2 className="m-0">Create New Session</h2>
          {isApprovedInstructor && <span className="badge success">{isAdmin ? "Admin" : "Instructor"}</span>}
        </div>
        <p className="small">Set the demand model, pricing, and duration before you launch.</p>

        <div className="hr" />

        <div className="row between baseline">
          <h3 className="m-0">Demand Distribution</h3>
          <span className="small">Training + in-game demand draws</span>
        </div>
        <div className="grid two">
          <div>
            <label>Mean (mu)</label>
            <input
              type="number"
              title="Mean demand"
              value={params.demandMu}
              onChange={(e) => setParams((p) => ({ ...p, demandMu: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label>Std Deviation (sigma)</label>
            <input
              type="number"
              title="Standard deviation of demand"
              value={params.demandSigma}
              onChange={(e) => setParams((p) => ({ ...p, demandSigma: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="row between baseline mt-16">
          <h3 className="m-0">Pricing</h3>
          <span className="small">All values are per-unit</span>
        </div>
        <div className="grid three">
          <div>
            <label>Sales Price</label>
            <input type="number" title="Sales price per unit" step="0.01" value={params.price} onChange={(e) => setParams((p) => ({ ...p, price: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Unit Cost</label>
            <input type="number" title="Unit cost" step="0.01" value={params.cost} onChange={(e) => setParams((p) => ({ ...p, cost: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Salvage Value</label>
            <input type="number" title="Salvage value per unit" step="0.01" value={params.salvage} onChange={(e) => setParams((p) => ({ ...p, salvage: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="row between baseline mt-16">
          <h3 className="m-0">Duration</h3>
          <span className="small">{params.weeks * params.daysPerWeek} total days</span>
        </div>
        <div className="grid three">
          <div>
            <label>Weeks in Game</label>
            <input
              type="number"
              title="Number of weeks"
              min={1}
              max={52}
              step={1}
              value={params.weeks}
              onChange={(e) => setParams((p) => ({ ...p, weeks: Math.max(1, Math.min(52, Math.round(Number(e.target.value)))) }))}
            />
          </div>
          <div>
            <label>Days per Week</label>
            <input
              type="number"
              title="Number of days per week"
              min={1}
              max={7}
              step={1}
              value={params.daysPerWeek}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (e.target.value !== "" && Number.isInteger(n) && n >= 1 && n <= 7) {
                  setParams((p) => ({ ...p, daysPerWeek: n }));
                }
              }}
              onBlur={(e) => {
                const n = Math.round(Number(e.target.value));
                setParams((p) => ({ ...p, daysPerWeek: Number.isFinite(n) ? Math.max(1, Math.min(7, n)) : p.daysPerWeek }));
              }}
            />
          </div>
          <div>
            <label>Schedule</label>
            <div className="small schedule-note">
              {params.weeks} weeks × {params.daysPerWeek} days/week = <span className="mono">{params.weeks * params.daysPerWeek}</span> in-game days, <span className="mono">{params.weeks}</span> decisions
            </div>
          </div>
        </div>

        <div className="hr" />

        <div className="row between baseline mt-16">
          <h3 className="m-0">Options</h3>
        </div>
        <div className="grid two">
          <label className={`option-card${params.asyncMode ? " selected" : ""}`}>
            <div className="option-card-header">
              <input
                type="checkbox"
                checked={params.asyncMode}
                onChange={(e) => setParams((p) => ({ ...p, asyncMode: e.target.checked }))}
              />
              <span className="option-card-title">Async Mode</span>
            </div>
            <p className="option-card-desc">Players work through all weeks at their own pace. Reveal the leaderboard when everyone is done.</p>
          </label>
          <label className={`option-card${params.noDragons ? " selected" : ""}`}>
            <div className="option-card-header">
              <input
                type="checkbox"
                checked={params.noDragons}
                onChange={(e) => setParams((p) => ({ ...p, noDragons: e.target.checked }))}
              />
              <span className="option-card-title">No Dragons</span>
            </div>
            <p className="option-card-desc">Hides the dragon mascot images from the player view.</p>
          </label>
        </div>

        <div className="hr" />

        <div className="row">
          <button className={`btn${busy ? " loading" : ""}`} disabled={busy || !isApprovedInstructor} onClick={createSession}>
            Create Session
          </button>
          {!isApprovedInstructor && <span className="small text-danger">Instructor access required.</span>}
        </div>

        {msg && <div className="hr" />}
        {msg && <p className="text-danger">{msg}</p>}
      </div>

      <div className="card">
        <div className="row mb-8">
          <h2 className="m-0">Your Sessions</h2>
          <span className="badge">{activeSessions.length} active</span>
        </div>
        <p className="small">Click to open the host control room.</p>
        <div className="warning-notice">
          <p className="small">
            Sessions are automatically deleted after 30 days.
          </p>
        </div>
        <div className="hr" />
        {listMsg && <p className="text-danger">{listMsg}</p>}
        {activeSessions.length === 0 ? (
          <div className="empty-state">
            <p className="small">No active sessions. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid">
            {activeSessions.map((s) => {
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
                    <div className="flex-1">
                      <div className="row gap-8 mb-4">
                        <span className="mono font-bold text-md">{s.data.code}</span>
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
                        disabled={busy}
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

        {finishedSessions.length > 0 && (
          <>
            <div className="hr" />
            <div className="row mb-8">
              <h3 className="m-0">Completed Sessions</h3>
              <span className="badge">{finishedSessions.length} total</span>
            </div>
            <p className="small">Open to review, or delete if no longer needed.</p>
            <div className="grid">
              {finishedSessions.map((s) => (
                <div key={s.id} className="player-card">
                  <div className="row">
                    <div className="flex-1">
                      <div className="row gap-8 mb-4">
                        <span className="mono font-bold text-md">{s.data.code}</span>
                        <span className="status-dot finished" />
                      </div>
                      <div className="small">
                        Week {(s.data.weekIndex ?? 0) + 1} of {s.data.weeks ?? 10} · {s.data.playersCount ?? 0} players
                      </div>
                    </div>
                    <div className="row">
                      <Link className="btn secondary" to={`/host/session/${s.id}`}>Open</Link>
                      <button
                        className="btn danger"
                        disabled={busy}
                        onClick={() => deleteSession(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="hr" />
        <p className="small">
          Players join at the homepage using the session code.
        </p>
      </div>

      <div className="card">
        <h2>Setup Summary</h2>
        <p className="small">A quick snapshot of the configuration you are about to launch.</p>
        <div className="hr" />
        {(() => {
          const underage = params.price - params.cost;
          const overage = params.cost - params.salvage;
          const cf = overage + underage > 0 ? underage / (underage + overage) : null;
          const optQ = cf !== null && params.demandSigma > 0
            ? Math.round(params.demandMu + params.demandSigma * probit(cf))
            : cf !== null ? Math.round(params.demandMu) : null;
          return (
            <>
              <div className="kpi">
                <div className="pill accent">
                  Mean: <span className="mono">{params.demandMu}</span>
                </div>
                <div className="pill">
                  Std: <span className="mono">{params.demandSigma}</span>
                </div>
                <div className="pill">
                  Weeks: <span className="mono">{params.weeks}</span>
                </div>
                <div className="pill">
                  Days: <span className="mono">{params.weeks * params.daysPerWeek}</span>
                </div>
              </div>
              <div className="hr" />
              <div className="grid two">
                <div className="card highlight">
                  <h3>Margins</h3>
                  <p className="small mt-6">
                    Sell: <span className="mono">${params.price.toFixed(2)}</span> / Cost:{" "}
                    <span className="mono">${params.cost.toFixed(2)}</span> / Salvage:{" "}
                    <span className="mono">${params.salvage.toFixed(2)}</span>
                  </p>
                  {cf !== null && (
                    <p className="small">
                      Critical fractile: <span className="mono">{(cf * 100).toFixed(1)}%</span>
                      {optQ !== null && <> · Optimal Q: <span className="mono">{optQ}</span></>}
                    </p>
                  )}
                </div>
                <div className="card">
                  <h3>Notes</h3>
                  <p className="small">
                    You can redraw the distribution before starting if you want a different dataset.
                  </p>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="card">
        <h2>Guides &amp; Resources</h2>
        <p className="small">Download PDF guides for yourself and your students.</p>
        <div className="hr" />
        <GuideDownloadButtons role="instructor" />
      </div>
    </div>
  );
}
