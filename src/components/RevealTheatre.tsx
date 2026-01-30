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
  const weeks = session.weeks ?? 10;
  const totalDays = weeks * 5;
  const revealed = session.revealedDemands ?? [];
  const training = session.trainingDemands ?? [];
  const meanHat = training.length ? training.reduce((a, b) => a + b, 0) / training.length : 0;
  const stdHat = training.length > 1
    ? Math.sqrt(training.reduce((a, b) => a + (b - meanHat) ** 2, 0) / (training.length - 1))
    : 0;

  const [toast, setToast] = useState<string>("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (revealIndex > 0) {
      const day = revealIndex - 1;
      const week = Math.floor(day / 5) + 1;
      const dow = DOW[day % 5];
      setToast(`🥐 Bakery doors open… Week ${week} · ${dow} demand revealed!`);
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
  const currentWeekOrder = player.ordersByWeek?.[session.weekIndex ?? 0] ?? null;
  const isDeciding = currentWeekOrder === null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Revealed Demand</h2>
        <span className="small">Bakery doors open Mon–Fri</span>
      </div>

      <div className="kpi" style={{ gap: "6px 8px" }}>
        <div className="pill" style={{ padding: "4px 10px" }}>Week: <span className="mono">{(session.weekIndex ?? 0) + 1}/{weeks}</span></div>
        <div className="pill" style={{ padding: "4px 10px" }}>Revealed: <span className="mono">{revealIndex}/{totalDays}</span></div>
        <div className="pill" style={{ padding: "4px 10px" }}>
          Plan: <span className="mono">{orderQty ?? "—"}</span>
        </div>
        <div className="pill" style={{ padding: "4px 10px" }}>
          Profit: <span className="mono">{weeklyProfit.toFixed(2)}</span>
        </div>
        <div className="pill" style={{ padding: "4px 10px" }}>Total: <span className="mono">{cum.toFixed(2)}</span></div>
      </div>

      <div className="hr" style={{ margin: "8px 0" }} />

      <div className="grid five">
        {Array.from({ length: 5 }, (_, i) => {
          const d = weekDays[i];
          const entry = daily.find((x) => x.idx === i);
          const isRevealed = typeof d === "number";
          const isHigh = isRevealed && d > meanHat + stdHat;
          const isLow = isRevealed && d < meanHat - stdHat;
          const cardClass = `day-card${isRevealed ? " revealed" : ""}${isHigh ? " high-demand" : ""}${isLow ? " low-demand" : ""}`;
          const profitValue = entry?.profit ?? 0;
          const profitColor = profitValue > 0 ? "var(--success)" : profitValue < 0 ? "var(--danger)" : "inherit";
          return (
            <motion.div
              key={i}
              className={cardClass}
              initial={{ opacity: 0.6, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <div className="day-label">{DOW[i]}</div>
              <div className={`demand-value${!isRevealed ? " unrevealed" : ""}`}>
                <span>{isRevealed ? d : "?"}</span>
                <span className="small">{isHigh ? "☀️" : isLow ? "🌧️" : isRevealed ? "☁️" : ""}</span>
              </div>

              <div className="profit-row">
                <div className="mono" style={{ fontWeight: 700, color: isRevealed ? profitColor : "inherit", textAlign: "center", fontSize: "12px" }}>
                  {isRevealed ? (profitValue >= 0 ? "+" : "") + profitValue.toFixed(2) : "—"}
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
