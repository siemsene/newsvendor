import React, { useMemo, useState } from "react";
import type { LeaderboardRow, PlayerDoc } from "../lib/types";

const LEADERBOARD_PAGE_SIZE = 50;

const rankMedals: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function Leaderboard({ players, rows }: { players?: PlayerDoc[]; rows?: LeaderboardRow[] }) {
  const [showAll, setShowAll] = useState(false);

  const computedRows = useMemo(() => {
    if (rows && rows.length) {
      return [...rows].sort((a, b) => b.profit - a.profit);
    }
    const source = players ?? [];
    const enriched = source.map((p) => {
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
  }, [players, rows]);

  const displayedRows = showAll ? computedRows : computedRows.slice(0, LEADERBOARD_PAGE_SIZE);
  const hasMore = computedRows.length > LEADERBOARD_PAGE_SIZE;

  if (computedRows.length === 0) {
    return (
      <div className="card">
        <h2>Leaderboard</h2>
        <p className="small">No players yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Leaderboard</h2>
        <span className="badge">{computedRows.length} players</span>
      </div>
      <p className="small">
        Total profit and average order quantity.
        {hasMore && !showAll && ` Showing top ${LEADERBOARD_PAGE_SIZE}.`}
      </p>

      <div className="hr" />
      <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Rank</th>
              <th>Baker</th>
              <th style={{ textAlign: "right" }}>Profit</th>
              <th style={{ textAlign: "right" }}>Avg Order</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const profitColor = r.profit >= 0 ? "var(--success)" : "var(--danger)";
              return (
                <tr key={r.uid} className={isTop3 ? "highlight" : ""}>
                  <td className="mono" style={{ fontWeight: isTop3 ? 700 : 400 }}>
                    {rankMedals[rank] ?? rank}
                  </td>
                  <td style={{ fontWeight: isTop3 ? 600 : 400 }}>{r.name}</td>
                  <td className="mono" style={{ textAlign: "right", color: profitColor, fontWeight: 600 }}>
                    {r.profit >= 0 ? "+" : ""}{r.profit.toFixed(2)}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.avgOrder.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="btn ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show top 50 only" : `Show all ${computedRows.length} players`}
          </button>
        </div>
      )}
    </div>
  );
}
