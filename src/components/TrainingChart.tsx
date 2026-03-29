import React from "react";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, Line, ReferenceLine, DefaultTooltipContent } from "recharts";
import { histogram, normalCurvePoints } from "../lib/stats";

export function TrainingChart({
  demands,
  meanHat,
  sigmaHat,
  totalDays,
  trainingCount,
  daysPerWeek = 5,
}: {
  demands: number[];
  meanHat: number;
  sigmaHat: number;
  totalDays: number;
  trainingCount: number;
  daysPerWeek?: number;
}) {
  const bins = histogram(demands, 10);
  const curve = normalCurvePoints(meanHat, sigmaHat, bins.minX, bins.maxX, bins.data.length).map(
    (p) => p.y * bins.scaleToHistogram
  );
  const chartData = bins.data.map((b, i) => ({
    ...b,
    curve: curve[i] ?? 0,
  }));

  // Split series by period. Share the first game point with the train line so they connect visually.
  const series = demands.map((d, i) => {
    const isTraining = i < trainingCount;
    const isFirstGame = i === trainingCount;
    return {
      day: i + 1,
      train: isTraining || isFirstGame ? d : null,
      game: !isTraining ? d : null,
    };
  });

  // X-axis ticks: "Training" at midpoint of training period, then W1..Wn at each game week start.
  const trainMid = trainingCount > 0 ? Math.ceil(trainingCount / 2) : null;
  const totalGameWeeks = Math.ceil((totalDays - trainingCount) / daysPerWeek);
  const weekTicks = Array.from({ length: totalGameWeeks }, (_, w) => trainingCount + w * daysPerWeek + 1);
  const ticks = [...(trainMid ? [trainMid] : []), ...weekTicks];

  const tickFormatter = (value: number) => {
    if (value === trainMid) return "Training";
    const w = Math.round((value - trainingCount - 1) / daysPerWeek) + 1;
    return `W${w}`;
  };

  // Latest dot on the game line only
  const gameLatestIndex = demands.length > trainingCount ? demands.length - 1 : -1;
  const gameLatestDot = (props: any) => {
    const { cx, cy, index } = props;
    if (typeof cx !== "number" || typeof cy !== "number") return <circle r={0} />;
    if (index !== gameLatestIndex) return <circle cx={cx} cy={cy} r={0} />;
    return (
      <g>
        <circle key={`latest-ring-${gameLatestIndex}`} className="latest-dot-ring" cx={cx} cy={cy} r={10} />
        <circle className="latest-dot" cx={cx} cy={cy} r={4} />
      </g>
    );
  };

  return (
    <div className="card training-chart-card">
      <h2>Demand Data</h2>
      <p className="small">
        Mean: <span className="mono">{meanHat.toFixed(2)}</span> · Std:{" "}
        <span className="mono">{sigmaHat.toFixed(2)}</span> · n={demands.length}
      </p>
      <div className="chart-with-ylabel">
        <span className="chart-ylabel">Frequency</span>
        <div className="chart-h-130">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ bottom: 18, left: 4, right: 8 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} stroke="var(--border)" label={{ value: "Demand", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted)" }} />
            <YAxis width={32} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
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
      </div>
      <div className="training-chart-series chart-with-ylabel">
        <span className="chart-ylabel">Demand</span>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, totalDays]}
              ticks={ticks}
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              allowDataOverflow
              stroke="var(--border)"
            />
            <YAxis width={32} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-sm)", color: "var(--ink)" }}
              itemStyle={{ color: "var(--ink)" }}
              formatter={(value: any, name: string) => [value, name === "train" ? "Training" : "Game"]}
              labelFormatter={(label) => `Day ${label}`}
            />
            {trainingCount > 0 && (
              <ReferenceLine
                x={trainingCount + 0.5}
                stroke="var(--border)"
                strokeDasharray="4 3"
                label={{ value: "Game →", position: "insideTopRight", fontSize: 10, fill: "var(--accent)", fontWeight: 600 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="train"
              stroke="var(--muted)"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              name="Training"
            />
            <Line
              type="monotone"
              dataKey="game"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={gameLatestDot}
              connectNulls={false}
              isAnimationActive={false}
              name="Game"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
