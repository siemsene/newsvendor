import React from "react";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, Line, DefaultTooltipContent } from "recharts";
import { histogram, normalCurvePoints } from "../lib/stats";

export function TrainingChart({
  demands,
  meanHat,
  sigmaHat,
  totalDays,
}: {
  demands: number[];
  meanHat: number;
  sigmaHat: number;
  totalDays: number;
}) {
  const bins = histogram(demands, 10);
  const curve = normalCurvePoints(meanHat, sigmaHat, bins.minX, bins.maxX, bins.data.length).map(
    (p) => p.y * bins.scaleToHistogram
  );
  const chartData = bins.data.map((b, i) => ({
    ...b,
    curve: curve[i] ?? 0,
  }));
  const series = demands.map((d, i) => ({ day: i + 1, demand: d }));
  const latestIndex = series.length - 1;
  const latestDot = (props: any) => {
    const { cx, cy, index } = props;
    if (typeof cx !== "number" || typeof cy !== "number") return <circle r={0} />;
    if (index !== latestIndex) return <circle cx={cx} cy={cy} r={0} />;
    return (
      <g>
        <circle key={`latest-ring-${latestIndex}`} className="latest-dot-ring" cx={cx} cy={cy} r={10} />
        <circle className="latest-dot" cx={cx} cy={cy} r={4} />
      </g>
    );
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <h2>Demand Data</h2>
      <p className="small">
        Mean: <span className="mono">{meanHat.toFixed(2)}</span> · Std:{" "}
        <span className="mono">{sigmaHat.toFixed(2)}</span> · n={demands.length}
      </p>
      <div style={{ height: 130 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} stroke="var(--border)" />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-sm)", color: "var(--ink)" }}
              itemStyle={{ color: "var(--ink)" }}
              content={(props) => {
                const payload = props.payload?.filter((p: any) => p?.dataKey !== "curve");
                return <DefaultTooltipContent {...props} payload={payload} />;
              }}
            />
            <Bar dataKey="count" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="curve" stroke="var(--chart-line)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minHeight: 140, marginTop: 8 }}>
        <ResponsiveContainer>
          <ComposedChart data={series}>
            <XAxis dataKey="day" type="number" domain={[1, totalDays]} tick={{ fontSize: 11, fill: "var(--muted)" }} allowDataOverflow stroke="var(--border)" />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
            <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-sm)", color: "var(--ink)" }} />
            <Line type="monotone" dataKey="demand" stroke="var(--chart-line)" strokeWidth={2} dot={latestDot} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
