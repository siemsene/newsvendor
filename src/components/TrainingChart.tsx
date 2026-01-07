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

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <h2>Demand Data</h2>
      <p className="small">
        Mean: <span className="mono">{meanHat.toFixed(2)}</span> · Std:{" "}
        <span className="mono">{sigmaHat.toFixed(2)}</span> · n={demands.length}
      </p>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
            <YAxis />
            <Tooltip
              content={(props) => {
                const payload = props.payload?.filter((p: any) => p?.dataKey !== "curve");
                return <DefaultTooltipContent {...props} payload={payload} />;
              }}
            />
            <Bar dataKey="count" />
            <Line type="monotone" dataKey="curve" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minHeight: 120, marginTop: 8 }}>
        <ResponsiveContainer>
          <ComposedChart data={series}>
            <XAxis dataKey="day" type="number" domain={[1, totalDays]} tick={{ fontSize: 11 }} allowDataOverflow />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="demand" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
