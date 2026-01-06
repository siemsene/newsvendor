import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import type { SessionPublic, PlayerDoc } from "../lib/types";
import { expandWeeklyOrdersToDays, computeWeeklyWhatIf } from "../lib/gameMath";

export function EndgameCharts({
  session,
  players,
}: {
  session: SessionPublic;
  players: PlayerDoc[];
}) {
  const days = session.revealedDemands ?? [];
  const optimalQ = session.optimalQ ?? 0;

  const avgOrderPerDay = useMemo(() => {
    const perPlayer = players.map((p) => expandWeeklyOrdersToDays(p.ordersByWeek ?? []));
    const n = perPlayer.length || 1;
    const out = Array.from({ length: 50 }, (_, i) => {
      const s = perPlayer.reduce((acc, arr) => acc + (arr[i] ?? 0), 0);
      return s / n;
    });
    return out;
  }, [players]);

  const lineData = useMemo(() => {
    return Array.from({ length: days.length }, (_, i) => ({
      day: i + 1,
      demand: days[i],
      optimalQ,
      avgOrder: avgOrderPerDay[i] ?? 0,
    }));
  }, [days, optimalQ, avgOrderPerDay]);

  const weeklyWhatIf = useMemo(() => {
    return computeWeeklyWhatIf({
      inGameDemands: days.slice(0, 50),
      price: session.price,
      cost: session.cost,
      salvage: session.salvage,
      optimalQ,
      delta: 10,
    });
  }, [days, session.price, session.cost, session.salvage, optimalQ]);

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
              <Line type="monotone" dataKey="demand" dot={false} />
              <Line type="monotone" dataKey="optimalQ" dot={false} />
              <Line type="monotone" dataKey="avgOrder" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>What-if profits (optimal vs ±10) by week</h2>
        <p className="small">This isolates the value of ordering near the optimal bake quantity.</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={weeklyWhatIf}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="profit_opt" />
              <Bar dataKey="profit_minus" />
              <Bar dataKey="profit_plus" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
