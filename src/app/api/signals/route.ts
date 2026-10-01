import { NextResponse } from "next/server";
import { SUPPORTED_COINS } from "@/lib/constants";
import {
  fearGreedSignal,
  percentChangeOver,
  rsiSignal,
  trendSignal,
  type Candle,
} from "@/lib/signals";

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ARB: "arbitrum",
  DOT: "polkadot",
  LINK: "chainlink",
  KSM: "kusama",
  PYTH: "pyth-network",
  SUI: "sui",
};

const REVALIDATE_SECONDS = 900;

async function fetchCandles(coinId: string): Promise<Candle[] | null> {
  // 30 days of OHLC returns 4-hour candles, enough for a 7-day trend and RSI(14)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=30`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );
  if (!res.ok) return null;
  const data: [number, number, number, number, number][] = await res.json();
  return data.map((c) => ({
    time: Math.floor(c[0] / 1000),
    open: c[1],
    high: c[2],
    low: c[3],
    close: c[4],
    volume: 0,
  }));
}

async function fetchFearGreed() {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const entry = data.data?.[0];
  if (!entry) return null;
  const value = parseInt(entry.value);
  return {
    value,
    classification: entry.value_classification as string,
    signal: fearGreedSignal(value, entry.value_classification),
  };
}

export async function GET() {
  try {
    const [fearGreed, ...coinResults] = await Promise.allSettled([
      fetchFearGreed(),
      ...SUPPORTED_COINS.map((coin) => fetchCandles(SYMBOL_TO_COINGECKO[coin.symbol])),
    ]);

    const coins = SUPPORTED_COINS.map((coin, i) => {
      const result = coinResults[i];
      const candles = result.status === "fulfilled" ? result.value : null;
      if (!candles || candles.length === 0) {
        return { symbol: coin.symbol, name: coin.name, available: false as const };
      }
      return {
        symbol: coin.symbol,
        name: coin.name,
        available: true as const,
        price: candles[candles.length - 1].close,
        change7d: percentChangeOver(candles, 7),
        trend: trendSignal(candles, 7),
        rsi: rsiSignal(candles),
      };
    });

    return NextResponse.json({
      fearGreed: fearGreed.status === "fulfilled" ? fearGreed.value : null,
      coins,
      generatedAt: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to compute signals" }, { status: 500 });
  }
}
