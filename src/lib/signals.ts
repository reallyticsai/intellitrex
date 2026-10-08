export type SignalCandle = {
  time: number;
  close: number;
};

export type Sma20Signal = {
  candles: SignalCandle[];
  latestClose: number;
  sma20: number;
  deviation: number;
  classification: "Above average" | "Below average" | "Near average";
  timestamp: number;
};

/** Returns no signal when the latest 20 chronological closes cannot be trusted. */
export function calculateSma20Signal(input: unknown): Sma20Signal | null {
  if (!Array.isArray(input) || input.length < 20) return null;

  // Validate timestamps before sorting; never mutate the API response.
  if (input.some((candle) =>
    !candle || typeof candle !== "object" ||
    !Number.isFinite(candle.time) || candle.time <= 0 ||
    !Number.isFinite(new Date(candle.time * 1000).getTime())
  )) return null;

  const candles: SignalCandle[] = [...input]
    .sort((a, b) => a.time - b.time)
    .slice(-20)
    .map(({ time, close }) => ({ time, close }));

  if (candles.some((candle, index) =>
    !Number.isFinite(candle.close) || candle.close <= 0 ||
    (index > 0 && candle.time === candles[index - 1].time)
  )) return null;

  // Divide before summing so valid large closes do not overflow the sum.
  const sma20 = candles.reduce((sum, candle) => sum + candle.close / 20, 0);
  const latest = candles[candles.length - 1];
  const deviation = ((latest.close - sma20) / sma20) * 100;
  if (!Number.isFinite(sma20) || sma20 <= 0 || !Number.isFinite(deviation)) return null;

  return {
    candles,
    latestClose: latest.close,
    sma20,
    deviation,
    classification: deviation > 1 ? "Above average" : deviation < -1 ? "Below average" : "Near average",
    timestamp: latest.time,
  };
}
