import { SUPPORTED_COINS } from "@/lib/constants";

const COINGECKO_ID_BY_KRAKEN_PAIR: Record<string, string> = {
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

type CoinGeckoMarket = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  current_price: number | null;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  sparkline_in_7d: { price: number[] };
};

export async function GET() {
  const ids = SUPPORTED_COINS.map((coin) => COINGECKO_ID_BY_KRAKEN_PAIR[coin.krakenPair]);

  if (ids.some((id) => !id)) {
    return Response.json({ error: "Market data configuration is incomplete." }, { status: 502 });
  }

  try {
    const params = new URLSearchParams({
      vs_currency: "usd",
      ids: ids.join(","),
      sparkline: "true",
      price_change_percentage: "1h,24h,7d",
      order: "market_cap_desc",
      per_page: String(ids.length),
      page: "1",
    });
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      return Response.json({ error: "Market data is temporarily unavailable." }, { status: 502 });
    }

    const payload = (await response.json()) as CoinGeckoMarket[];
    if (!Array.isArray(payload) || payload.length !== ids.length) {
      return Response.json({ error: "Market data is incomplete." }, { status: 502 });
    }

    const markets = payload.map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      market_cap_rank: coin.market_cap_rank,
      current_price: coin.current_price,
      price_change_percentage_1h_in_currency: coin.price_change_percentage_1h_in_currency,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
      market_cap: coin.market_cap,
      total_volume: coin.total_volume,
      high_24h: coin.high_24h,
      low_24h: coin.low_24h,
      sparkline_in_7d: {
        price: (coin.sparkline_in_7d?.price ?? []).filter(Number.isFinite),
      },
    }));

    return Response.json(markets);
  } catch {
    return Response.json({ error: "Market data is temporarily unavailable." }, { status: 502 });
  }
}
