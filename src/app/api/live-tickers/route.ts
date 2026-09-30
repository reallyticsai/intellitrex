import { NextResponse } from "next/server";

const MARKET_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ARBUSDT", "DOTUSDT"];

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
};
type LiveTicker = { price: number; change: number };

export async function GET() {
  const url = new URL("https://data-api.binance.vision/api/v3/ticker/24hr");
  url.searchParams.set("symbols", JSON.stringify(MARKET_SYMBOLS));

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Live market data is unavailable" }, { status: 502 });
    }

    const data = (await response.json()) as BinanceTicker[];
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Live market data is unavailable" }, { status: 502 });
    }

    const tickers = data.reduce<Record<string, LiveTicker>>((result, ticker) => {
      const price = Number(ticker.lastPrice);
      const change = Number(ticker.priceChangePercent);
      if (Number.isFinite(price) && Number.isFinite(change)) {
        result[ticker.symbol.replace(/USDT$/, "")] = { price, change };
      }
      return result;
    }, {});

    return NextResponse.json(
      { tickers, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json({ error: "Live market data is unavailable" }, { status: 502 });
  }
}
