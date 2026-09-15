import { describe, expect, it } from "vitest";
import { priceAt, scoreTrade, totalScore } from "./game";
describe("Paperhood scoring", () => {
  it("rewards percentage loss, not spend or profits", () => {
    expect(scoreTrade(100, 80)).toBe(2000);
    expect(scoreTrade(100, 120)).toBe(0);
    expect(scoreTrade(100, 100)).toBe(0);
    expect(scoreTrade(200, 160)).toBe(2000);
  });
  it("ignores invalid purchase values", () => {
    expect(scoreTrade(0, 10)).toBe(0);
    expect(scoreTrade(Infinity, 10)).toBe(0);
    expect(scoreTrade(100, NaN)).toBe(0);
  });
  it("adds multiple trades and keeps simulated prices positive", () => {
    expect(
      totalScore([
        { buy: 100, sell: 80, points: 2000 },
        { buy: 100, sell: 90, points: 1000 },
      ]),
    ).toBe(3000);
    for (let t = 0; t <= 120; t++) {
      expect(priceAt(t, 2)).toBeGreaterThan(0);
      expect(Number.isFinite(priceAt(t, 2))).toBe(true);
    }
  });
});
