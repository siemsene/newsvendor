import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SessionPublic, PlayerDoc } from "../lib/types";
import { profitForDay } from "../lib/gameMath";
import { Toast } from "./Toast";

// Dragon images for weekly cheer
import dragon1 from "../assets/dragons/dragon_1.webp";
import dragon2 from "../assets/dragons/dragon_2.webp";
import dragon3 from "../assets/dragons/dragon_3.webp";
import dragon4 from "../assets/dragons/dragon_4.webp";
import dragon5 from "../assets/dragons/dragon_5.webp";
import dragon6 from "../assets/dragons/dragon_6.webp";
import dragon7 from "../assets/dragons/dragon_7.webp";
import dragon8 from "../assets/dragons/dragon_8.webp";
import dragon9 from "../assets/dragons/dragon_9.webp";
import dragon10 from "../assets/dragons/dragon_10.webp";
import dragon11 from "../assets/dragons/dragon_11.webp";

const DRAGONS = [dragon1, dragon2, dragon3, dragon4, dragon5, dragon6, dragon7, dragon8, dragon9, dragon10, dragon11];

const ALL_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RevealTheatre({
  session,
  player,
  asyncRevealOverride,
}: {
  session: SessionPublic;
  player: PlayerDoc;
  asyncRevealOverride?: {
    demands: number[];
    profits: number[];
    weekIndex: number;
    cumulativeProfit: number;
  };
}) {
  const weeks = session.weeks ?? 10;
  const daysPerWeek = session.daysPerWeek ?? 5;
  const totalDays = weeks * daysPerWeek;
  const DOW = ALL_DOW.slice(0, daysPerWeek);
  const training = session.trainingDemands ?? [];
  const meanHat = training.length ? training.reduce((a, b) => a + b, 0) / training.length : 0;
  const stdHat = training.length > 1
    ? Math.sqrt(training.reduce((a, b) => a + (b - meanHat) ** 2, 0) / (training.length - 1))
    : 0;

  // In async mode we use the override; in sync mode we use the session's reveal state.
  const syncRevealIndex = session.revealIndex ?? 0;
  const currentWeekIndex = asyncRevealOverride
    ? asyncRevealOverride.weekIndex
    : Math.floor(Math.max(0, syncRevealIndex - 1) / daysPerWeek);
  const weekStart = currentWeekIndex * daysPerWeek;
  const weekDays = asyncRevealOverride
    ? asyncRevealOverride.demands
    : (session.revealedDemands ?? []).slice(weekStart, weekStart + daysPerWeek);
  const revealIndex = asyncRevealOverride
    ? (asyncRevealOverride.weekIndex + 1) * daysPerWeek
    : syncRevealIndex;

  const orderQty = player.ordersByWeek?.[currentWeekIndex] ?? null;

  const [toast, setToast] = useState<string>("");
  const [showToast, setShowToast] = useState(false);

  // Toast fires on sync reveal only (async players see all days at once).
  useEffect(() => {
    if (!asyncRevealOverride && syncRevealIndex > 0) {
      const day = syncRevealIndex - 1;
      const week = Math.floor(day / daysPerWeek) + 1;
      const dow = ALL_DOW[day % daysPerWeek] ?? `Day ${(day % daysPerWeek) + 1}`;
      setToast(`🥐 Bakery doors open… Week ${week} · ${dow} demand revealed!`);
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 2200);
      return () => clearTimeout(t);
    }
  }, [syncRevealIndex, asyncRevealOverride]);

  const daily = useMemo(() => {
    return weekDays.map((d, idx) => {
      const profit = asyncRevealOverride
        ? (asyncRevealOverride.profits[idx] ?? 0)
        : profitForDay({ D: d, Q: orderQty ?? 0, price: session.price, cost: session.cost, salvage: session.salvage });
      return { idx, d, profit };
    });
  }, [weekDays, orderQty, session.price, session.cost, session.salvage, asyncRevealOverride]);

  const weeklyProfit = daily.reduce((a, b) => a + b.profit, 0);
  const cum = asyncRevealOverride ? asyncRevealOverride.cumulativeProfit : (player.cumulativeProfit ?? 0);
  const dragonWeekIndex = asyncRevealOverride ? asyncRevealOverride.weekIndex : (session.weekIndex ?? 0);
  const displayWeekIndex = asyncRevealOverride ? asyncRevealOverride.weekIndex : (session.weekIndex ?? 0);

  return (
    <div className="card">
      <div className="row between baseline mb-8">
        <h2 className="m-0">Revealed Demand</h2>
        <span className="small">Bakery doors open each day this week</span>
      </div>

      <div className="kpi gap-sm">
        <div className="pill sm">Week: <span className="mono">{displayWeekIndex + 1}/{weeks}</span></div>
        <div className="pill sm">Revealed: <span className="mono">{revealIndex}/{totalDays}</span></div>
        <div className="pill sm">
          Plan: <span className="mono">{orderQty ?? "—"}</span>
        </div>
        <div className="pill sm">
          Profit: <span className="mono">{weeklyProfit.toFixed(2)}</span>
        </div>
        <div className="pill sm">Total: <span className="mono">{cum.toFixed(2)}</span></div>
      </div>

      <div className="hr sm" />

      <div className={`grid grid-days-${daysPerWeek}`}>
        {Array.from({ length: daysPerWeek }, (_, i) => {
          const d = weekDays[i];
          const entry = daily.find((x) => x.idx === i);
          const isRevealed = typeof d === "number";
          const isHigh = isRevealed && Number.isFinite(meanHat) && Number.isFinite(stdHat) && d > meanHat + 0.5 * stdHat;
          const isLow = isRevealed && Number.isFinite(meanHat) && Number.isFinite(stdHat) && d < meanHat - 0.5 * stdHat;
          const cardClass = `day-card${isRevealed ? " revealed" : ""}${isHigh ? " high-demand" : ""}${isLow ? " low-demand" : ""}`;
          const profitValue = entry?.profit ?? 0;
          const profitClass = isRevealed ? (profitValue > 0 ? "text-success" : profitValue < 0 ? "text-danger" : "") : "";
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
                <div className={`mono font-bold text-center text-xs ${profitClass}`}>
                  {isRevealed ? (profitValue >= 0 ? "+" : "") + profitValue.toFixed(2) : "—"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Dragon of the week! */}
      {!session.noDragons && (
        <div className="dragon-wrap">
          <motion.img
            key={dragonWeekIndex}
            src={DRAGONS[dragonWeekIndex % DRAGONS.length]}
            alt="Dragon of the week"
            className="dragon-img"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          />
        </div>
      )}

      <Toast message={toast} show={showToast} />
    </div>
  );
}
