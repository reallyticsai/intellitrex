import { NextResponse } from "next/server";
import { SUPPORTED_COINS } from "@/lib/constants";

const ids: Record<string, string> = { XXBTZUSD: "bitcoin", XETHZUSD: "ethereum", SOLUSD: "solana", XXRPZUSD: "ripple", ARBUSD: "arbitrum", DOTUSD: "polkadot", LINKUSD: "chainlink", KSMUSD: "kusama", PYTHUSD: "pyth-network", SUIUSD: "sui" };
const coinIds = SUPPORTED_COINS.map((coin) => ids[coin.krakenPair]).join(",");

type Coin = { id: string; name: string; symbol: string; market_cap_rank: number | null; current_price: number | null; price_change_percentage_24h: number | null; price_change_percentage_7d_in_currency: number | null; market_cap: number | null; total_volume: number | null; high_24h: number | null; low_24h: number | null; sparkline_in_7d: { price: number[] } };

export async function GET() {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&sparkline=true&price_change_percentage=1h,24h,7d`, { next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
    const data = (await response.json()) as Coin[];
    return NextResponse.json(data.map((coin) => ({ id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase(), rank: coin.market_cap_rank, price: coin.current_price, change24h: coin.price_change_percentage_24h, change7d: coin.price_change_percentage_7d_in_currency, marketCap: coin.market_cap, volume: coin.total_volume, high24h: coin.high_24h, low24h: coin.low_24h, sparkline: coin.sparkline_in_7d.price })));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load market data" }, { status: 502 });
  }
}
