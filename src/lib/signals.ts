export type BollingerBands = {
  middle: number[];
  upper: number[];
  lower: number[];
};

export type LogReturnStats = {
  mu: number;
  sigma: number;
};

export type ProjectionPoint = {
  day: number;
  median: number;
  lower68: number;
  upper68: number;
  lower95: number;
  upper95: number;
};

export type SignalVote = {
  signal: "SMA trend" | "RSI 14" | "Bollinger" | "P(up)";
  value: -1 | 0 | 1;
  reason: string;
};

export type SignalSummary = {
  label: "Bullish" | "Bearish" | "Neutral";
  total: number;
  votes: SignalVote[];
};

export type SummaryInputs = {
  close?: number;
  sma20?: number;
  sma50?: number;
  rsi14?: number;
  bollinger?: { upper: number; lower: number };
  probabilityUp?: number;
};

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

export function sma(values: readonly number[], window: number): number[] {
  if (!Number.isInteger(window) || window <= 0 || values.length < window) return [];

  const result: number[] = [];
  let total = values.slice(0, window).reduce((sum, value) => sum + value, 0);
  result.push(total / window);

  for (let index = window; index < values.length; index += 1) {
    total += values[index] - values[index - window];
    result.push(total / window);
  }

  return result;
}

export function bollinger(
  values: readonly number[],
  window = 20,
  multiplier = 2
): BollingerBands {
  const middle = sma(values, window);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let index = window - 1; index < values.length; index += 1) {
    const mean = middle[index - window + 1];
    const variance = values
      .slice(index - window + 1, index + 1)
      .reduce((sum, value) => sum + (value - mean) ** 2, 0) / window;
    const deviation = Math.sqrt(variance);
    upper.push(mean + multiplier * deviation);
    lower.push(mean - multiplier * deviation);
  }

  return { middle, upper, lower };
}

export function rsi(values: readonly number[], period = 14): number[] {
  if (!Number.isInteger(period) || period <= 0 || values.length <= period) return [];

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  const result = [rsiValue(averageGain, averageLoss)];

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result.push(rsiValue(averageGain, averageLoss));
  }

  return result;
}

function rsiValue(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function logReturnStats(
  prices: readonly number[],
  window = 90
): LogReturnStats | null {
  if (!Number.isInteger(window) || window <= 0 || prices.length < window + 1) return null;

  const returns = prices.slice(-(window + 1)).map((price, index, series) => {
    if (index === 0) return null;
    return Math.log(price / series[index - 1]);
  }).slice(1);

  if (returns.some((value) => value === null || !Number.isFinite(value))) return null;
  const logReturns = returns as number[];
  const mu = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, value) => sum + (value - mu) ** 2, 0) / logReturns.length;
  return { mu, sigma: Math.sqrt(variance) };
}

export function projectionCone(
  price: number,
  mu: number,
  sigma: number,
  days = 7
): ProjectionPoint[] {
  if (!Number.isInteger(days) || days <= 0 || ![price, mu, sigma].every(Number.isFinite)) return [];

  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const drift = mu * day;
    const spread = sigma * Math.sqrt(day);
    return {
      day,
      median: price * Math.exp(drift),
      lower68: price * Math.exp(drift - spread),
      upper68: price * Math.exp(drift + spread),
      lower95: price * Math.exp(drift - 1.96 * spread),
      upper95: price * Math.exp(drift + 1.96 * spread),
    };
  });
}

export function probabilityUp(mu: number, sigma: number): number {
  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || sigma < 0) return Number.NaN;
  if (sigma === 0) return mu === 0 ? 0.5 : mu > 0 ? 1 : 0;
  const z = (mu * 7) / (sigma * Math.sqrt(7));
  return normalCdf(z);
}

function normalCdf(value: number): number {
  if (value === 0) return 0.5;
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

export function summarize(inputs: SummaryInputs): SignalSummary {
  const votes: SignalVote[] = [
    smaVote(inputs.sma20, inputs.sma50),
    rsiVote(inputs.rsi14),
    bollingerVote(inputs.close, inputs.bollinger),
    probabilityVote(inputs.probabilityUp),
  ];
  const total = votes.reduce((sum, vote) => sum + vote.value, 0);
  return {
    label: total >= 2 ? "Bullish" : total <= -2 ? "Bearish" : "Neutral",
    total,
    votes,
  };
}

function smaVote(sma20: number | undefined, sma50: number | undefined): SignalVote {
  if (!isFiniteNumber(sma20) || !isFiniteNumber(sma50)) return { signal: "SMA trend", value: 0, reason: "Not enough data" };
  if (sma20 > sma50) return { signal: "SMA trend", value: 1, reason: "SMA 20 is above SMA 50" };
  if (sma20 < sma50) return { signal: "SMA trend", value: -1, reason: "SMA 20 is below SMA 50" };
  return { signal: "SMA trend", value: 0, reason: "SMA 20 equals SMA 50" };
}

function rsiVote(value: number | undefined): SignalVote {
  if (!isFiniteNumber(value)) return { signal: "RSI 14", value: 0, reason: "Not enough data" };
  if (value < 30) return { signal: "RSI 14", value: 1, reason: `RSI 14 is ${value.toFixed(1)} (oversold)` };
  if (value > 70) return { signal: "RSI 14", value: -1, reason: `RSI 14 is ${value.toFixed(1)} (overbought)` };
  return { signal: "RSI 14", value: 0, reason: `RSI 14 is ${value.toFixed(1)}` };
}

function bollingerVote(close: number | undefined, bands: SummaryInputs["bollinger"]): SignalVote {
  if (!isFiniteNumber(close) || !bands || !isFiniteNumber(bands.upper) || !isFiniteNumber(bands.lower)) return { signal: "Bollinger", value: 0, reason: "Not enough data" };
  if (close < bands.lower) return { signal: "Bollinger", value: 1, reason: "Close is below the lower band" };
  if (close > bands.upper) return { signal: "Bollinger", value: -1, reason: "Close is above the upper band" };
  return { signal: "Bollinger", value: 0, reason: "Close is inside the bands" };
}

function probabilityVote(value: number | undefined): SignalVote {
  if (!isFiniteNumber(value)) return { signal: "P(up)", value: 0, reason: "Not enough data" };
  if (value > 0.55) return { signal: "P(up)", value: 1, reason: `P(up) is ${(value * 100).toFixed(1)}%` };
  if (value < 0.45) return { signal: "P(up)", value: -1, reason: `P(up) is ${(value * 100).toFixed(1)}%` };
  return { signal: "P(up)", value: 0, reason: `P(up) is ${(value * 100).toFixed(1)}%` };
}
