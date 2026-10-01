export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SignalDirection = "bullish" | "neutral" | "bearish";

export type Signal = {
  direction: SignalDirection;
  label: string;
  reason: string;
};

export function computeSMA(candles: Candle[], period: number): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    const slice = candles.slice(i - period + 1, i + 1);
    return slice.reduce((sum, c) => sum + c.close, 0) / period;
  });
}

export function computeRSI(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function computeBollinger(
  candles: Candle[],
  period = 20,
  mult = 2
): { upper: (number | null)[]; lower: (number | null)[]; middle: (number | null)[] } {
  const middle = computeSMA(candles, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  candles.forEach((_, i) => {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
      return;
    }
    const slice = candles.slice(i - period + 1, i + 1);
    const std = Math.sqrt(
      slice.reduce((sum, c) => sum + Math.pow(c.close - middle[i]!, 2), 0) / period
    );
    upper.push(middle[i]! + mult * std);
    lower.push(middle[i]! - mult * std);
  });

  return { upper, lower, middle };
}

// Percent change between the latest close and the close nearest to `days` ago.
// Uses timestamps rather than candle counts because candle granularity varies by range.
export function percentChangeOver(candles: Candle[], days: number): number | null {
  if (candles.length < 2) return null;
  const latest = candles[candles.length - 1];
  const target = latest.time - days * 86400;
  const past = candles.find((c) => c.time >= target) ?? candles[0];
  if (past === latest || past.close === 0) return null;
  return ((latest.close - past.close) / past.close) * 100;
}

const TREND_THRESHOLD_PCT = 3;

export function trendSignal(candles: Candle[], days = 7): Signal | null {
  const change = percentChangeOver(candles, days);
  if (change === null) return null;
  const pct = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  if (change > TREND_THRESHOLD_PCT) {
    return { direction: "bullish", label: "Uptrend", reason: `${pct} over ${days} days` };
  }
  if (change < -TREND_THRESHOLD_PCT) {
    return { direction: "bearish", label: "Downtrend", reason: `${pct} over ${days} days` };
  }
  return { direction: "neutral", label: "Sideways", reason: `${pct} over ${days} days` };
}

export function rsiSignal(candles: Candle[], period = 14): Signal | null {
  const rsi = computeRSI(candles, period);
  const last = rsi[rsi.length - 1];
  if (last === null || last === undefined) return null;
  const value = last.toFixed(0);
  if (last > 70) {
    return { direction: "bearish", label: "Overbought", reason: `RSI ${value} is above 70` };
  }
  if (last < 30) {
    return { direction: "bullish", label: "Oversold", reason: `RSI ${value} is below 30` };
  }
  return { direction: "neutral", label: "Neutral", reason: `RSI ${value} is between 30 and 70` };
}

// Contrarian read of the Fear & Greed Index: extreme fear has historically
// preceded rebounds and extreme greed has preceded pullbacks.
export function fearGreedSignal(value: number, classification: string): Signal {
  if (value <= 25) {
    return { direction: "bullish", label: classification, reason: "Extreme fear can signal a buying opportunity" };
  }
  if (value >= 75) {
    return { direction: "bearish", label: classification, reason: "Extreme greed can signal an overheated market" };
  }
  return { direction: "neutral", label: classification, reason: "Sentiment is not at an extreme" };
}
