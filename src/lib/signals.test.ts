import { describe, expect, it } from "vitest";
import { bollinger, logReturnStats, probabilityUp, projectionCone, rsi, sma, summarize } from "./signals";

describe("price signals", () => {
  it("calculates a rolling SMA", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
  });

  it("returns 100 RSI for a strictly rising series", () => {
    expect(rsi(Array.from({ length: 20 }, (_, index) => index + 1), 14).at(-1)).toBe(100);
  });

  it("returns 0.5 P(up) when drift is zero", () => {
    expect(probabilityUp(0, 0.02)).toBe(0.5);
  });

  it("uses population standard deviation for Bollinger bands", () => {
    expect(bollinger([1, 2, 3], 3)).toEqual({
      middle: [2],
      upper: [2 + 2 * Math.sqrt(2 / 3)],
      lower: [2 - 2 * Math.sqrt(2 / 3)],
    });
  });

  it("uses the last 90 log returns and produces a seven-day cone", () => {
    const prices = Array.from({ length: 91 }, (_, index) => 100 * Math.exp(index * 0.01));
    expect(logReturnStats(prices)?.mu).toBeCloseTo(0.01);
    expect(logReturnStats(prices)?.sigma).toBeCloseTo(0);
    expect(projectionCone(100, 0.01, 0, 7)).toHaveLength(7);
  });

  it("labels a two-vote total as bullish", () => {
    expect(summarize({ sma20: 110, sma50: 100, rsi14: 20, close: 100, bollinger: { upper: 110, lower: 90 }, probabilityUp: 0.5 })).toMatchObject({
      label: "Bullish",
      total: 2,
    });
  });
});
