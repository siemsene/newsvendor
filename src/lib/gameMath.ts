export function profitForDay({
  D,
  Q,
  price,
  cost,
  salvage,
}: {
  D: number;
  Q: number;
  price: number;
  cost: number;
  salvage: number;
}) {
  const sold = Math.min(Q, D);
  const leftover = Math.max(0, Q - sold);
  return price * sold + salvage * leftover - cost * Q;
}

export function expandWeeklyOrdersToDays(ordersByWeek: Array<number | null>) {
  const out: number[] = [];
  for (let w = 0; w < 10; w++) {
    const q = ordersByWeek[w] ?? 0;
    for (let d = 0; d < 5; d++) out.push(q);
  }
  return out;
}

export function computeWeeklyWhatIf({
  inGameDemands,
  price,
  cost,
  salvage,
  optimalQ,
  delta,
}: {
  inGameDemands: number[];
  price: number;
  cost: number;
  salvage: number;
  optimalQ: number;
  delta: number;
}) {
  const weeks = 10;
  const rows: Array<any> = [];
  for (let w = 0; w < weeks; w++) {
    const start = w * 5;
    const slice = inGameDemands.slice(start, start + 5);
    const profit = (Q: number) => slice.reduce((acc, D) => acc + profitForDay({ D, Q, price, cost, salvage }), 0);
    rows.push({
      week: w + 1,
      profit_opt: profit(optimalQ),
      profit_minus: profit(Math.max(0, optimalQ - delta)),
      profit_plus: profit(optimalQ + delta),
    });
  }
  return rows;
}
