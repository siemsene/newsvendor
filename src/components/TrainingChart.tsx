import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { histogram, normalCurvePoints } from "../lib/stats";

export function TrainingChart({
  demands,
  meanHat,
  sigmaHat,
}: {
  demands: number[];
  meanHat: number;
  sigmaHat: number;
}) {
  const bins = histogram(demands, 10);
  const curve = normalCurvePoints(meanHat, sigmaHat, bins.minX, bins.maxX, 50).map((p) => ({
    x: p.x,
    y: p.y * bins.scaleToHistogram,
  }));

  return (
    <div className="grid two">
      <div className="card">
        <h2>Training demand (50 historical days)</h2>
        <p>Histogram of croissant demand. (You'll place weekly bake plans next.)</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={bins.data}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Overlay: fitted Normal(μ̂, σ̂)</h2>
        <p className="mono">μ̂={meanHat.toFixed(2)} · σ̂={sigmaHat.toFixed(2)}</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={curve}>
              <XAxis dataKey="x" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="y" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
