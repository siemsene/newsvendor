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
      <div className="row mb-8">
        <h2 className="m-0">Leaderboard</h2>
        <span className="badge">{computedRows.length} players</span>
      </div>
      <p className="small">
        Total profit and average order quantity.
        {hasMore && !showAll && ` Showing top ${LEADERBOARD_PAGE_SIZE}.`}
      </p>

      <div className="hr" />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="col-60">Rank</th>
              <th>Baker</th>
              <th className="text-right">Profit</th>
              <th className="text-right">Avg Order</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const profitColor = r.profit >= 0 ? "var(--success)" : "var(--danger)";
              return (
                <tr key={r.uid} className={isTop3 ? "highlight" : ""}>
                  <td className={`mono${isTop3 ? " font-bold" : ""}`}>
                    {rankMedals[rank] ?? rank}
                  </td>
                  <td className={isTop3 ? "font-semi" : ""}>{r.name}</td>
                  <td className="mono text-right font-semi" style={{ color: profitColor }}>
                    {r.profit >= 0 ? "+" : ""}{r.profit.toFixed(2)}
                  </td>
                  <td className="mono text-right">{r.avgOrder.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="mt-16 text-center">
          <button className="btn ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show top 50 only" : `Show all ${computedRows.length} players`}
          </button>
        </div>
      )}
    </div>
  );
}
