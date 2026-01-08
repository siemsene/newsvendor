import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import type { PlayerDoc, SessionPublic } from "../lib/types";
import { api } from "../lib/api";
import { mean, std, skewness, excessKurtosis, histogram } from "../lib/stats";
import { Leaderboard } from "../components/Leaderboard";
import { EndgameCharts } from "../components/EndgameCharts";
import { Bar, ComposedChart, LineChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function HostSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionPublic | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [inGameDemands, setInGameDemands] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [autoMsg, setAutoMsg] = useState("");
  const sessionRef = useRef<SessionPublic | null>(null);
  const autoRevealRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const unsubS = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      const data = snap.exists() ? (snap.data() as any) : null;
      setSession(data);
      sessionRef.current = data;
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

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, "sessions", sessionId, "private", "demand"), (snap) => {
      const data = snap.exists() ? (snap.data() as any) : null;
      const demands = Array.isArray(data?.inGameDemands) ? data.inGameDemands : [];
      setInGameDemands(demands);
    });
    return () => unsub();
  }, [sessionId]);

  const weekIndex = session?.weekIndex ?? 0;
  const weeks = session?.weeks ?? 10;
  const totalDays = weeks * 5;
  const submitted = useMemo(() => {
    return players.filter((p) => (p.ordersByWeek?.[weekIndex] ?? null) !== null);
  }, [players, weekIndex]);

  const allSubmitted = players.length > 0 && submitted.length === players.length;
  const showLeaderboard = session?.showLeaderboard === true;
  const trainingDemands = session?.trainingDemands ?? [];
  const allDemands = useMemo(() => trainingDemands.concat(inGameDemands), [trainingDemands, inGameDemands]);
  const meanHat = useMemo(() => mean(allDemands), [allDemands]);
  const sigmaHat = useMemo(() => std(allDemands), [allDemands]);
  const skewHat = useMemo(() => skewness(allDemands), [allDemands]);
  const kurtHat = useMemo(() => excessKurtosis(allDemands), [allDemands]);
  const demandHistogram = useMemo(() => (allDemands.length ? histogram(allDemands, 10) : null), [allDemands]);
  const payoffData = useMemo(() => {
    if (!session || inGameDemands.length === 0) return [];
    const optimalQ = Number(session.optimalQ ?? 0);
    const delta = Math.max(1, Math.round(0.15 * Math.max(1, optimalQ)));
    const minQ = Math.max(0, Math.round(optimalQ - delta));
    const maxQ = Math.max(minQ + 1, Math.round(optimalQ + delta));
    const step = maxQ - minQ > 150 ? 5 : 1;
    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);

    const rows: Array<{ q: number; profit: number }> = [];
    for (let q = minQ; q <= maxQ; q += step) {
      let profit = 0;
      for (const d of inGameDemands) {
        const sold = Math.min(q, d);
        const leftover = Math.max(0, q - sold);
        profit += price * sold + salvage * leftover - cost * q;
      }
      rows.push({ q, profit });
    }
    return rows;
  }, [session, inGameDemands]);
  const bestInGame = useMemo(() => {
    if (!session || inGameDemands.length === 0) return null;
    const maxDemand = Math.max(0, ...inGameDemands);
    const maxQ = Math.max(10, Math.ceil(maxDemand + Number(session.demandSigma ?? 0)));
    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);
    let bestQ = 0;
    let bestProfit = -Infinity;
    for (let q = 0; q <= maxQ; q++) {
      let profit = 0;
      for (const d of inGameDemands) {
        const sold = Math.min(q, d);
        const leftover = Math.max(0, q - sold);
        profit += price * sold + salvage * leftover - cost * q;
      }
      if (profit > bestProfit) {
        bestProfit = profit;
        bestQ = q;
      }
    }
    return { q: bestQ, profit: bestProfit };
  }, [session, inGameDemands]);
  const payoffDomain = useMemo(() => {
    if (!payoffData.length) return undefined;
    let min = payoffData[0].profit;
    let max = payoffData[0].profit;
    for (const row of payoffData) {
      if (row.profit < min) min = row.profit;
      if (row.profit > max) max = row.profit;
    }
    const pad = Math.max(1, Math.round(0.08 * Math.max(1, Math.abs(max - min))));
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number];
  }, [payoffData]);


  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      autoRevealRef.current = false;
    };
  }, []);

  function delay(ms: number) {
    return new Promise<void>((resolve) => {
      autoTimerRef.current = window.setTimeout(() => resolve(), ms);
    });
  }

  async function runAutoReveal() {
    if (!sessionId) return;
    if (autoRevealRef.current) return;
    autoRevealRef.current = true;
    setAutoMsg("Auto-reveal running...");
    try {
      while (true) {
        const current = sessionRef.current;
        if (!current) break;
        if (current.status === "finished") break;
        if (current.status !== "ordering" && current.status !== "revealing") break;
        const revealIndex = current.revealIndex ?? 0;
        const currentTotalDays = (current.weeks ?? 10) * 5;
        if (revealIndex >= currentTotalDays) break;

        await api.advanceReveal({ sessionId });
        await delay(1500);

        const next = sessionRef.current;
        if (!next) break;
        if (next.status === "ordering" && next.revealIndex % 5 === 0) break;
      }
    } catch (e: any) {
      console.error(e);
      setAutoMsg(e?.message ?? "Auto-reveal failed");
    } finally {
      autoRevealRef.current = false;
      autoTimerRef.current = null;
      setAutoMsg((prev) => (prev === "Auto-reveal running..." ? "" : prev));
    }
  }

  useEffect(() => {
    if (!session) return;
    if (session.status === "ordering" && allSubmitted) {
      runAutoReveal();
    }
  }, [session?.status, session?.revealIndex, allSubmitted, sessionId]);

  async function start() {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      await api.startSession({ sessionId });
      setMsg("Session started. Waiting for orders...");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Start session failed");
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

  async function kick(uid: string) {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      await api.kickPlayer({ sessionId, uid });
      setMsg("Player kicked.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Kick failed");
    } finally {
      setBusy(false);
    }
  }

  async function redraw() {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      const res = await api.redrawSession({ sessionId });
      setMsg(res.data.ok ? "Distribution redrawn." : "Feasible dataset not drawn in this attempt - please hit the redraw button.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Redraw failed");
    } finally {
      setBusy(false);
    }
  }

  async function endEarly() {
    if (!sessionId) return;
    if (!confirm("End the session early? This will finalize all remaining days.")) return;
    setMsg("");
    setBusy(true);
    try {
      await api.endSession({ sessionId });
      setMsg("Session ended.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "End session failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLeaderboard(next: boolean) {
    if (!sessionId) return;
    setMsg("");
    setBusy(true);
    try {
      await updateDoc(doc(db, "sessions", sessionId), { showLeaderboard: next });
      setMsg(next ? "Leaderboard visible to players." : "Leaderboard hidden from players.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function csvEscape(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "";
    const raw = String(value);
    if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
      return `"${raw.replace(/"/g, "\"\"")}"`;
    }
    return raw;
  }

  function downloadCsv() {
    if (!session || !sessionId) return;
    const weeks = session.weeks ?? 10;
    const totalDays = weeks * 5;
    const inGame = inGameDemands.length ? inGameDemands : session.revealedDemands ?? [];
    const rows: string[] = [];
    rows.push(
      [
        "sessionId",
        "sessionCode",
        "week",
        "day",
        "demand",
        "playerUid",
        "playerName",
        "orderQty",
      ].join(",")
    );

    const dayCount = Math.min(inGame.length, totalDays);
    for (let i = 0; i < dayCount; i++) {
      const week = Math.floor(i / 5) + 1;
      const day = (i % 5) + 1;
      for (const p of players) {
        const orders = Array.isArray(p.ordersByWeek) ? p.ordersByWeek : [];
        const orderQty = orders[week - 1] ?? "";
        rows.push(
          [
            sessionId,
            session.code,
            week,
            day,
            inGame[i],
            p.uid,
            p.name,
            orderQty,
          ].map(csvEscape).join(",")
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `session-${session.code}-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!session) {
    return (
      <div className="card">
        <h2>Host control room</h2>
        <p className="small">Loading session…</p>
      </div>
    );
  }


  return (
    <div className="grid">
      <div className="card">
        <h2>Host control room</h2>
        <p className="small">
          Session code: <span className="badge mono">{session.code}</span> · Status:{" "}
          <span className="mono">{session.status}</span>
        </p>

        {session.drawFailed && (
          <p className="small" style={{ color: "#7a2d2d" }}>
            Feasible dataset not drawn in this attempt - please hit the redraw button.
          </p>
        )}

        <div className="kpi" style={{ marginTop: 10 }}>
          <div className="pill">
            Week: <span className="mono">{weekIndex + 1}/{weeks}</span>
          </div>
          <div className="pill">
            Revealed days: <span className="mono">{session.revealIndex}/{totalDays}</span>
          </div>
          <div className="pill">
            Optimal Q*: <span className="mono">{session.optimalQ}</span>
          </div>
          {bestInGame && (
            <div className="pill">
              Best in-game Q: <span className="mono">{bestInGame.q}</span>
            </div>
          )}
        </div>

        <div className="hr" />

        <div className="row">
          {session.status === "training" ? (
            <>
              <button className="btn" disabled={busy || players.length === 0} onClick={start}>
                Start session
              </button>
              <button className="btn ghost" disabled={busy} onClick={redraw}>
                Redraw distribution
              </button>
            </>
          ) : (
            <span className="small">
              Submitted this week: <span className="mono">{submitted.length}/{players.length}</span>{" "}
              {allSubmitted ? "All in. Auto-reveal will run." : ""}
            </span>
          )}
          {session.status !== "finished" && (
            <button className="btn secondary" disabled={busy} onClick={endEarly}>
              End session early
            </button>
          )}
          <div className="spacer" />
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={showLeaderboard}
              disabled={busy}
              onChange={(e) => toggleLeaderboard(e.target.checked)}
            />
            Show leaderboard to players
          </label>
        </div>

        {msg && <div className="hr" />}
        {msg && <p className="small">{msg}</p>}
        {autoMsg && <div className="hr" />}
        {autoMsg && <p className="small">{autoMsg}</p>}

        {session.status === "finished" && (
          <>
            <div className="hr" />
            <div className="row">
              <button className="btn secondary" onClick={downloadCsv}>
                Download game data (CSV)
              </button>
              <span className="small">Opens in Excel.</span>
            </div>
          </>
        )}
      </div>

      {session.status === "training" && (
        <>
          <div className="card">
            <h2>Demand overview</h2>
            <p className="small">
              Mean: <span className="mono">{meanHat.toFixed(2)}</span> · Std:{" "}
              <span className="mono">{sigmaHat.toFixed(2)}</span> · Skew:{" "}
              <span className="mono">{skewHat.toFixed(2)}</span> · Kurtosis (excess):{" "}
              <span className="mono">{kurtHat.toFixed(2)}</span> · n={allDemands.length}
            </p>
            <p className="small">Includes training and in-game draws (host only).</p>
            {demandHistogram && (
              <div style={{ height: 200 }}>
                <ResponsiveContainer>
                  <ComposedChart data={demandHistogram.data}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card">
            <h2>In-game payoff curve</h2>
            <p className="small">
              Profit across all in-game days vs. order quantity (Q). Optimal Q* is{" "}
              <span className="mono">{session.optimalQ}</span>.
            </p>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={payoffData}>
                  <XAxis dataKey="q" tick={{ fontSize: 11 }} />
                  <YAxis domain={payoffDomain} />
                  <Tooltip
                    formatter={(value) => {
                      if (typeof value === "number") return Math.round(value);
                      return value as any;
                    }}
                  />
                  <Line type="monotone" dataKey="profit" dot={false} />
                  <ReferenceLine x={session.optimalQ} stroke="#6b4f2a" strokeDasharray="3 3" />
                  {bestInGame && (
                    <ReferenceDot x={bestInGame.q} y={bestInGame.profit} r={5} fill="#1f5f47" stroke="none" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h2>Player matrix</h2>
        <p className="small">Track weekly submissions, nudge laggards, or remove players.</p>
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
                        <span className="mono">{has ? p.ordersByWeek?.[weekIndex] : "-"}</span>
                        {" - "}
                        Submitted: <span className="mono">{has ? "yes" : "no"}</span>
                        {" - "}
                        Profit: <span className="mono">{(p.cumulativeProfit ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="spacer" />
                    <div className="row">
                      <button className="btn ghost" disabled={busy || has} onClick={() => nudge(p.uid)}>
                        Nudge {'>'}
                      </button>
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Kick ${p.name}?`)) {
                            kick(p.uid);
                          }
                        }}
                      >
                        Kick x
                      </button>
                    </div>
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
