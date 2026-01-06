export function profitForDay(D: number, Q: number, price: number, cost: number, salvage: number) {
  const sold = Math.min(Q, D);
  const leftover = Math.max(0, Q - sold);
  return price * sold + salvage * leftover - cost * Q;
}
