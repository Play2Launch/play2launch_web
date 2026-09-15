export type Trade = { buy: number; sell: number; points: number };
export function priceAt(tick: number, seed: number): number {
  return Math.max(
    15,
    Math.round(
      (100 +
        Math.sin(tick * 0.31 + seed) * 28 +
        Math.sin(tick * 0.81 + seed * 2) * 14 +
        Math.cos(tick * 0.11) * 17) *
        100,
    ) / 100,
  );
}
export function scoreTrade(buy: number, sell: number): number {
  if (buy <= 0 || !Number.isFinite(buy) || !Number.isFinite(sell)) return 0;
  return Math.max(0, Math.round(((buy - sell) / buy) * 10000));
}
export function totalScore(trades: Trade[]): number {
  return trades.reduce((sum, trade) => sum + trade.points, 0);
}
