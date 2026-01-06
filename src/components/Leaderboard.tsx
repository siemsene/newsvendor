import React, { useMemo } from "react";
import type { PlayerDoc } from "../lib/types";

export function Leaderboard({ players }: { players: PlayerDoc[] }) {
  const rows = useMemo(() => {
    const enriched = players.map((p) => {
      const orders = (p.ordersByWeek ?? []).filter((x) => typeof x === "number") as number[];
      const avgOrder = orders.length ? orders.reduce((a, b) => a + b, 0) / orders.length : 0;
      return {
        uid: p.uid,
        name: p.name ?? "Anonymous",
        profit: p.cumulativeProfit ?? 0,
        avgOrder,
      };
    });
    enriched.sort((a, b) => b.profit - a.profit);
    return enriched;
  }, [players]);

  return (
    <div className="card">
      <h2>Leaderboard</h2>
      <p className="small">Total profit and average bake plan (across submitted weeks).</p>

      <div className="hr" />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, color: "rgba(43,42,40,0.7)" }}>
              <th style={{ padding: "8px 6px" }}>Rank</th>
              <th style={{ padding: "8px 6px" }}>Baker</th>
              <th style={{ padding: "8px 6px" }}>Profit</th>
              <th style={{ padding: "8px 6px" }}>Avg order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <td style={{ padding: "8px 6px" }} className="mono">{idx + 1}</td>
                <td style={{ padding: "8px 6px" }}>{r.name}</td>
                <td style={{ padding: "8px 6px" }} className="mono">{r.profit.toFixed(2)}</td>
                <td style={{ padding: "8px 6px" }} className="mono">{r.avgOrder.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
