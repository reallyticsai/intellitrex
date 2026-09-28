import { NextRequest, NextResponse } from "next/server";

// Map our pair IDs to CoinGecko IDs
const PAIR_TO_COINGECKO: Record<string, string> = {
  XXBTZUSD: "bitcoin",
  XETHZUSD: "ethereum",
  SOLUSD: "solana",
  XXRPZUSD: "ripple",
  ARBUSD: "arbitrum",
  DOTUSD: "polkadot",
  LINKUSD: "chainlink",
  KSMUSD: "kusama",
  PYTHUSD: "pyth-network",
  SUIUSD: "sui",
};


export async function GET(req: NextRequest) {
  const pair = req.nextUrl.searchParams.get("pair") || "XXBTZUSD";
  const interval = req.nextUrl.searchParams.get("interval") || "1440";
  const limit = req.nextUrl.searchParams.get("limit") || "30";
  const resolution = req.nextUrl.searchParams.get("resolution");

  const coinId = PAIR_TO_COINGECKO[pair] || "bitcoin";

  // Determine days from limit + interval
  let days = limit;
  if (interval === "60") days = "1";
  else if (parseInt(limit) > 365) days = "max";

  try {
    if (resolution === "daily") {
      const dailyRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
        { next: { revalidate: 60 } }
      );
      const dailyData = await dailyRes.json();

      if (!dailyRes.ok || !dailyData.prices) {
        return NextResponse.json({ error: "Failed to fetch daily prices" }, { status: 500 });
      }

      const candles = dailyData.prices.map(
        ([time, price]: [number, number]) => ({
          time: Math.floor(time / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        })
      );
      return NextResponse.json({ pair, candles });
    }

    // Fetch OHLC data from CoinGecko
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      // Fallback to market_chart for simple price data
      const fallbackRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
        { next: { revalidate: 60 } }
      );
      const fallbackData = await fallbackRes.json();

      if (fallbackData.prices) {
        const candles = fallbackData.prices.map(
          ([time, price]: [number, number]) => ({
            time: Math.floor(time / 1000),
            open: price,
            high: price * 1.001,
            low: price * 0.999,
            close: price,
            volume: 0,
          })
        );
        return NextResponse.json({ pair, candles });
      }
      return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
    }

    const ohlcData = await res.json();

    // CoinGecko OHLC format: [[timestamp, open, high, low, close], ...]
    const candles = ohlcData.map(
      (c: [number, number, number, number, number]) => ({
        time: Math.floor(c[0] / 1000),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: 0,
      })
    );

    return NextResponse.json({ pair, candles });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
