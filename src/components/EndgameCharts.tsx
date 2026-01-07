import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { SessionPublic, PlayerDoc } from "../lib/types";
import { expandWeeklyOrdersToDays } from "../lib/gameMath";

export function EndgameCharts({
  session,
  players,
}: {
  session: SessionPublic;
  players: PlayerDoc[];
}) {
  const days = session.revealedDemands ?? [];
  const optimalQ = session.optimalQ ?? 0;
  const weeks = session.weeks ?? 10;
  const totalDays = weeks * 5;
  const dayCount = Math.min(days.length, totalDays);

  const avgOrderPerDay = useMemo(() => {
    const perPlayer = players.map((p) => expandWeeklyOrdersToDays(p.ordersByWeek ?? []));
    const n = perPlayer.length || 1;
    const out = Array.from({ length: totalDays }, (_, i) => {
      const s = perPlayer.reduce((acc, arr) => acc + (arr[i] ?? 0), 0);
      return s / n;
    });
    return out;
  }, [players, totalDays]);

  const avgDemand = useMemo(() => {
    if (!days.length) return 0;
    const total = days.reduce((a, b) => a + b, 0);
    return total / days.length;
  }, [days]);

  const lineData = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      avgDemand,
      optimalQ,
      avgOrder: avgOrderPerDay[i] ?? 0,
    }));
  }, [dayCount, avgDemand, optimalQ, avgOrderPerDay]);

  const payoffCurve = useMemo(() => {
    const inGame = days.slice(0, totalDays);
    if (inGame.length === 0) return [];
    const maxDemand = Math.max(...inGame, Number(optimalQ ?? 0));
    const maxQ = Math.max(10, Math.ceil(maxDemand + Number(session.demandSigma ?? 0)));
    const step = maxQ > 150 ? 5 : 2;
    const price = Number(session.price ?? 1);
    const cost = Number(session.cost ?? 0.2);
    const salvage = Number(session.salvage ?? 0);

    const rows: Array<{ q: number; profit: number }> = [];
    for (let q = 0; q <= maxQ; q += step) {
      let profit = 0;
      for (const d of inGame) {
        const sold = Math.min(q, d);
        const leftover = Math.max(0, q - sold);
        profit += price * sold + salvage * leftover - cost * q;
      }
      rows.push({ q, profit });
    }
    return rows;
  }, [days, optimalQ, session.price, session.cost, session.salvage, session.demandSigma, totalDays]);

  return (
    <div className="grid two">
      <div className="card">
        <h2>In-game time series (demand, optimal, average order)</h2>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgDemand" dot={false} stroke="#0b3d91" strokeWidth={2} name="Avg demand" />
              <Line type="monotone" dataKey="optimalQ" dot={false} stroke="#d62828" strokeWidth={2} name="Optimal Q" />
              <Line type="monotone" dataKey="avgOrder" dot={false} stroke="#2a9d8f" strokeWidth={2} name="Avg order" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>In-game payoff curve</h2>
        <p className="small">Profit across all in-game days vs. order quantity (Q).</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={payoffCurve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="q" />
              <YAxis />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === "number") return Math.round(value);
                  return value as any;
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="profit" dot={false} stroke="#6b4f2a" strokeWidth={2} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
