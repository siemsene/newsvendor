import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SessionPublic, PlayerDoc } from "../lib/types";
import { profitForDay } from "../lib/gameMath";
import { Toast } from "./Toast";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function RevealTheatre({
  session,
  player,
}: {
  session: SessionPublic;
  player: PlayerDoc;
}) {
  const revealIndex = session.revealIndex ?? 0;
  const revealed = session.revealedDemands ?? [];

  const [toast, setToast] = useState<string>("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (revealIndex > 0) {
      const day = revealIndex - 1;
      const week = Math.floor(day / 5) + 1;
      const dow = DOW[day % 5];
      setToast(`🥐 Oven doors open… Week ${week} · ${dow} demand revealed!`);
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 2200);
      return () => clearTimeout(t);
    }
  }, [revealIndex]);

  const currentDay = Math.max(0, revealIndex - 1);
  const currentWeekIndex = Math.floor(currentDay / 5);
  const weekStart = currentWeekIndex * 5;
  const weekDays = revealed.slice(weekStart, weekStart + 5);

  const orderQty = player.ordersByWeek?.[currentWeekIndex] ?? null;

  const daily = useMemo(() => {
    return weekDays.map((d, idx) => {
      const q = orderQty ?? 0;
      const pf = profitForDay({ D: d, Q: q, price: session.price, cost: session.cost, salvage: session.salvage });
      return { idx, d, q, profit: pf };
    });
  }, [weekDays, orderQty, session.price, session.cost, session.salvage]);

  const weeklyProfit = daily.reduce((a, b) => a + b.profit, 0);
  const cum = player.cumulativeProfit ?? 0;

  return (
    <div className="card">
      <h2>Weekly reveal theatre</h2>
      <p className="small">
        Demand is revealed day-by-day (Mon–Fri). Your bake plan is constant for the whole week.
      </p>

      <div className="kpi">
        <div className="pill">Week: <span className="mono">{(session.weekIndex ?? 0) + 1}/10</span></div>
        <div className="pill">Revealed days: <span className="mono">{revealIndex}/50</span></div>
        <div className="pill">Your bake plan (this week): <span className="mono">{orderQty ?? "—"}</span></div>
        <div className="pill">Week profit so far: <span className="mono">{weeklyProfit.toFixed(2)}</span></div>
        <div className="pill">Cumulative profit: <span className="mono">{cum.toFixed(2)}</span></div>
      </div>

      <div className="hr" />

      <div className="grid three">
        {Array.from({ length: 5 }, (_, i) => {
          const d = weekDays[i];
          const entry = daily.find((x) => x.idx === i);
          const isRevealed = typeof d === "number";
          return (
            <motion.div
              key={i}
              className="card"
              style={{ padding: 14, background: "rgba(255,255,255,0.75)" }}
              initial={{ opacity: 0.6, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mono" style={{ fontSize: 12, color: "rgba(43,42,40,0.7)" }}>
                {DOW[i]}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
                {isRevealed ? d : "?"}
              </div>
              <div className="small">demand</div>

              <div className="hr" />

              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small">profit</div>
                <div className="mono" style={{ fontWeight: 800 }}>
                  {isRevealed ? entry?.profit.toFixed(2) : "—"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Toast message={toast} show={showToast} />
    </div>
  );
}
