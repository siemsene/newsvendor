import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { SessionPublic, PlayerDoc } from "../lib/types";
import { expandWeeklyOrdersToDays } from "../lib/gameMath";

export function EndgameCharts({
  session,
  players,
  avgOrderPerDayOverride,
}: {
  session: SessionPublic;
  players?: PlayerDoc[];
  avgOrderPerDayOverride?: number[];
}) {
  const days = session.revealedDemands ?? [];
  const optimalQ = session.optimalQ ?? 0;
  const weeks = session.weeks ?? 10;
  const totalDays = weeks * 5;
  const rawReveal = Number(session.revealIndex);
  const revealIndex = Number.isFinite(rawReveal) ? Math.max(0, Math.round(rawReveal)) : days.length;
  const dayCount = Math.min(days.length, totalDays, revealIndex);
  const playedDays = days.slice(0, dayCount);

  const avgOrderPerDay = useMemo(() => {
    if (avgOrderPerDayOverride && avgOrderPerDayOverride.length) {
      return avgOrderPerDayOverride.slice(0, totalDays);
    }
    const sourcePlayers = players ?? [];
    if (!sourcePlayers.length) return Array.from({ length: totalDays }, () => 0);
    const perPlayer = sourcePlayers.map((p) => expandWeeklyOrdersToDays(p.ordersByWeek ?? []));
    const n = perPlayer.length || 1;
    return Array.from({ length: totalDays }, (_, i) => {
      const s = perPlayer.reduce((acc, arr) => acc + (arr[i] ?? 0), 0);
      return s / n;
    });
  }, [players, totalDays, avgOrderPerDayOverride]);

  const avgDemand = useMemo(() => {
    if (!playedDays.length) return 0;
    const total = playedDays.reduce((a, b) => a + b, 0);
    return total / playedDays.length;
  }, [playedDays]);

  const lineData = useMemo(() => {
    const weeksCount = Math.ceil(dayCount / 5);
    return Array.from({ length: weeksCount }, (_, i) => {
      const start = i * 5;
      const end = Math.min(start + 5, dayCount);
      const weekOrders = avgOrderPerDay.slice(start, end);
      const wAvgOrder = weekOrders.length ? weekOrders.reduce((a, b) => a + b, 0) / weekOrders.length : 0;

      return {
        week: i + 1,
        avgDemand,
        optimalQ,
        avgOrder: wAvgOrder,
      };
    });
  }, [dayCount, playedDays, optimalQ, avgOrderPerDay]);

  const payoffCurve = useMemo(() => {
    const inGame = playedDays;
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
  }, [playedDays, optimalQ, session.price, session.cost, session.salvage, session.demandSigma]);

  return (
    <div className="grid two">
      <div className="card">
        <h2>Weekly time series (avg demand, optimal, avg order)</h2>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)" label={{ value: "Week", position: "insideBottom", offset: -5, fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)" />
              <Tooltip
                contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-sm)", color: "var(--ink)" }}
                itemStyle={{ color: "var(--ink)" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
              <Line type="monotone" dataKey="avgDemand" dot={false} stroke="var(--chart-line)" strokeWidth={2} name="Global avg demand" />
              <Line type="monotone" dataKey="optimalQ" dot={false} stroke="var(--danger)" strokeWidth={2} name="Optimal Q" />
              <Line type="monotone" dataKey="avgOrder" dot={{ r: 3, fill: "var(--success)" }} stroke="var(--success)" strokeWidth={2} name="Avg order" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="q" tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)" label={{ value: "Order quantity", position: "insideBottom", offset: -6, fill: "var(--muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} stroke="var(--border)" label={{ value: "Profit", angle: -90, position: "insideLeft", offset: 10, fill: "var(--muted)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-sm)", color: "var(--ink)" }}
                itemStyle={{ color: "var(--ink)" }}
                formatter={(value) => {
                  if (typeof value === "number") return Math.round(value);
                  return value as any;
                }}
              />
              <Line type="monotone" dataKey="profit" dot={false} stroke="var(--accent)" strokeWidth={2} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
