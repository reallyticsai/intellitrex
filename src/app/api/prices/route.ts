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

  const coinId = PAIR_TO_COINGECKO[pair] || "bitcoin";

  if (["15", "30", "60", "240"].includes(interval)) {
    const url = new URL("https://api.kraken.com/0/public/OHLC");
    url.searchParams.set("pair", pair);
    url.searchParams.set("interval", interval);

    try {
      const res = await fetch(url, { next: { revalidate: 30 } });
      if (res.ok) {
        const data = await res.json();
        const pairKey = Object.keys(data.result ?? {}).find((key) => key !== "last");
        const ohlcData = pairKey ? data.result[pairKey] : null;
        if (!data.error?.length && Array.isArray(ohlcData)) {
          const parsedLimit = Number.parseInt(limit, 10);
          const candleLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 720)) : 96;
          const candles = ohlcData.slice(-candleLimit).map(
            (c: [number, string, string, string, string, string, string, number]) => ({
              time: c[0],
              open: Number(c[1]),
              high: Number(c[2]),
              low: Number(c[3]),
              close: Number(c[4]),
              volume: Number(c[6]),
            })
          );
          return NextResponse.json({ pair, candles, source: "kraken" });
        }
      }
    } catch {
      // Use sampled CoinGecko prices if Kraken is unavailable for this pair.
    }

    try {
      const fallbackDays = interval === "15" || interval === "30" ? "1" : interval === "60" ? "2" : "7";
      const fallbackRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${fallbackDays}`,
        { next: { revalidate: 30 } }
      );
      if (!fallbackRes.ok) {
        return NextResponse.json({ error: "Failed to fetch intraday prices" }, { status: 502 });
      }
      const fallbackData = await fallbackRes.json();
      if (!Array.isArray(fallbackData.prices)) {
        return NextResponse.json({ error: "Intraday prices are unavailable for this pair" }, { status: 502 });
      }

      const intervalSeconds = Number(interval) * 60;
      const buckets = new Map<number, number[]>();
      for (const [timestamp, price] of fallbackData.prices as [number, number][]) {
        const candleTime = Math.floor(timestamp / (intervalSeconds * 1000)) * intervalSeconds;
        const values = buckets.get(candleTime) ?? [];
        values.push(price);
        buckets.set(candleTime, values);
      }

      const parsedLimit = Number.parseInt(limit, 10);
      const candleLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 720)) : 96;
      const candles = Array.from(buckets, ([time, values]) => ({
        time,
        open: values[0],
        high: Math.max(...values),
        low: Math.min(...values),
        close: values[values.length - 1],
        volume: 0,
      })).slice(-candleLimit);

      return NextResponse.json({ pair, candles, source: "coingecko" });
    } catch {
      return NextResponse.json({ error: "Failed to fetch intraday prices" }, { status: 502 });
    }
  }

  // Determine days from limit + interval
  let days = limit;
  if (interval === "60") days = "1";
  else if (parseInt(limit) > 365) days = "max";

  try {
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
  } catch {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
