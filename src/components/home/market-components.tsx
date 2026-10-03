import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { SUPPORTED_COINS } from "@/lib/constants";

export type MarketCoin = {
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

type MarketStatus = "loading" | "ready" | "error";

export function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 7,
  }).format(value);
}

export function formatCompactUSD(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumSignificantDigits: 3,
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function changeTone(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "text-muted-foreground";
  return value >= 0 ? "text-success" : "text-danger";
}

function graphPoints(values: number[], width: number, height: number, padding = 2) {
  if (values.length < 2) return "";
  const validValues = values.filter(Number.isFinite);
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || 1;
  const graphHeight = height - padding * 2;
  return validValues
    .map((value, index) => {
      const x = (index / (validValues.length - 1)) * width;
      const y = height - padding - ((value - min) / range) * graphHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline({ market, className = "" }: { market: MarketCoin; className?: string }) {
  const values = market.sparkline_in_7d.price;
  if (values.length < 2) return <span className="text-sm text-muted-foreground">—</span>;
  const points = graphPoints(values, 120, 36, 3);
  const rising = values.at(-1)! >= values[0];

  return (
    <svg viewBox="0 0 120 36" className={className} aria-label={`${market.name} seven-day price trend`} role="img" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={rising ? "text-success" : "text-danger"} />
    </svg>
  );
}

export function BitcoinChart({ market }: { market: MarketCoin }) {
  const values = market.sparkline_in_7d.price;
  if (values.length < 2) {
    return <p className="flex h-44 items-center justify-center text-sm text-muted-foreground">Chart data unavailable</p>;
  }

  const points = graphPoints(values, 560, 180, 5);
  const lastY = Number(points.split(" ").at(-1)?.split(",")[1] ?? 90);
  const rising = values.at(-1)! >= values[0];
  const fillColor = rising ? "var(--success)" : "var(--danger)";

  return (
    <svg viewBox="0 0 560 180" className="h-44 w-full" aria-label="Bitcoin seven-day price chart" role="img" preserveAspectRatio="none">
      <defs>
        <linearGradient id="bitcoin-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${points.replaceAll(" ", " L ")} L 560 180 L 0 180 Z`} fill="url(#bitcoin-chart-fill)" />
      <polyline points={points} fill="none" stroke={fillColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="560" cy={lastY} r="4" fill={fillColor} />
    </svg>
  );
}

export function TickerStrip({ markets, status }: { markets: MarketCoin[]; status: MarketStatus }) {
  const marketBySymbol = new Map(markets.map((market) => [market.symbol.toUpperCase(), market]));
  const items = SUPPORTED_COINS.map((coin) => ({
    symbol: coin.symbol,
    market: marketBySymbol.get(coin.symbol.toUpperCase()),
  }));

  return (
    <section aria-label="Market ticker" className="overflow-hidden border-y border-border bg-card">
      <style>{`
        @keyframes intellitrex-market-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .intellitrex-market-ticker-track { animation: intellitrex-market-ticker 44s linear infinite; }
        .intellitrex-market-ticker:hover .intellitrex-market-ticker-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .intellitrex-market-ticker-track { animation: none; } }
      `}</style>
      <div className="intellitrex-market-ticker">
        <div className="intellitrex-market-ticker-track flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
              {items.map(({ symbol, market }) => (
                <Link key={`${copy}-${symbol}`} href="/currency" tabIndex={copy === 1 ? -1 : undefined} className="flex min-w-[148px] items-center gap-3 border-r border-border px-4 py-3 last:border-r-0 sm:min-w-[170px]">
                  <span className="text-xs font-semibold text-muted-foreground">{symbol}<span className="mx-1 text-border">/</span>USD</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {status === "loading" ? <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" /> : formatPrice(market?.current_price)}
                  </span>
                  {status === "loading"
                    ? <span className="inline-block h-3 w-10 animate-pulse rounded bg-muted" />
                    : <span className={`text-xs tabular-nums ${changeTone(market?.price_change_percentage_24h)}`}>{formatPercent(market?.price_change_percentage_24h)}</span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading market data">
      {SUPPORTED_COINS.map((coin) => (
        <div key={coin.symbol} className="h-[76px] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function MarketMobileCards({ markets }: { markets: MarketCoin[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {markets.map((market) => (
        <Link key={market.id} href="/currency" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">{market.symbol.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{market.name}</span>
                <span className="text-xs uppercase text-muted-foreground">{market.symbol}</span>
              </span>
            </div>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular-nums text-foreground">{formatPrice(market.current_price)}</span>
              <span className={`text-xs tabular-nums ${changeTone(market.price_change_percentage_24h)}`}>{formatPercent(market.price_change_percentage_24h)}</span>
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 items-end gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">Seven day <span className={`mt-1 block tabular-nums ${changeTone(market.price_change_percentage_7d_in_currency)}`}>{formatPercent(market.price_change_percentage_7d_in_currency)}</span></span>
            <span className="text-muted-foreground">Market cap <span className="mt-1 block tabular-nums text-foreground">{formatCompactUSD(market.market_cap)}</span></span>
            <span className="text-right text-muted-foreground">Volume <span className="mt-1 block tabular-nums text-foreground">{formatCompactUSD(market.total_volume)}</span></span>
          </div>
          <Sparkline market={market} className="mt-2 h-8 w-full" />
        </Link>
      ))}
    </div>
  );
}

export function MarketSummary({ markets, status }: { markets: MarketCoin[]; status: MarketStatus }) {
  return (
    <section id="market-summary" className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prices, performance, and liquidity</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Market summary</h2>
        </div>
        {status === "ready" && <p className="text-xs text-muted-foreground">Market data from CoinGecko</p>}
      </div>

      {status === "loading" ? <MarketSkeleton /> : status === "ready" ? (
        <>
          <MarketMobileCards markets={markets} />
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-muted/70 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-[6%] px-3 py-4">Rank</th>
                  <th className="w-[18%] px-3 py-4">Coin</th>
                  <th className="w-[13%] px-3 py-4">Price</th>
                  <th className="w-[9%] px-3 py-4">24h</th>
                  <th className="w-[9%] px-3 py-4">7d</th>
                  <th className="w-[15%] px-3 py-4">Market cap</th>
                  <th className="w-[15%] px-3 py-4">Volume</th>
                  <th className="w-[15%] px-3 py-4">Seven-day trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {markets.map((market) => (
                  <tr key={market.id} className="group hover:bg-muted/40">
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="block tabular-nums text-sm text-muted-foreground">{market.market_cap_rank ?? "—"}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-foreground">{market.symbol.slice(0, 1)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{market.name}</span><span className="text-xs uppercase text-muted-foreground">{market.symbol}</span></span></Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="block text-sm font-semibold tabular-nums text-foreground">{formatPrice(market.current_price)}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className={`block text-sm tabular-nums ${changeTone(market.price_change_percentage_24h)}`}>{formatPercent(market.price_change_percentage_24h)}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className={`block text-sm tabular-nums ${changeTone(market.price_change_percentage_7d_in_currency)}`}>{formatPercent(market.price_change_percentage_7d_in_currency)}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="block truncate text-sm tabular-nums text-foreground">{formatCompactUSD(market.market_cap)}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="block truncate text-sm tabular-nums text-foreground">{formatCompactUSD(market.total_volume)}</Link></td>
                    <td className="px-3 py-4"><Link href="/currency" aria-label={`Open ${market.name} chart`} className="block"><Sparkline market={market} className="h-8 w-full" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Market data is unavailable. Retry to refresh the summary.</p>
        </div>
      )}
    </section>
  );
}

function MoverList({ title, markets, gainers }: { title: string; markets: MarketCoin[]; gainers: boolean }) {
  const Icon = gainers ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className={`h-4 w-4 ${gainers ? "text-success" : "text-danger"}`} />{title}</h3>
      {markets.length ? (
        <ul className="mt-3 divide-y divide-border">
          {markets.map((market) => (
            <li key={market.id}>
              <Link href="/currency" className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{market.name}<span className="ml-2 text-xs uppercase text-muted-foreground">{market.symbol}</span></span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${changeTone(market.price_change_percentage_24h)}`}>{formatPercent(market.price_change_percentage_24h)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 py-3 text-sm text-muted-foreground">{gainers ? "No coins are up today" : "No coins are down today"}</p>}
    </div>
  );
}

export function TopMovers({ markets, status }: { markets: MarketCoin[]; status: MarketStatus }) {
  const sorted = markets
    .filter((market) => market.price_change_percentage_24h !== null && Number.isFinite(market.price_change_percentage_24h))
    .sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));
  const gainers = status === "ready" ? sorted.filter((market) => (market.price_change_percentage_24h ?? 0) > 0).slice(0, 3) : [];
  const losers = status === "ready" ? [...sorted].reverse().filter((market) => (market.price_change_percentage_24h ?? 0) < 0).slice(0, 3) : [];

  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Daily performance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Top movers</h2>
        </div>
        {status === "loading" ? <div className="grid gap-3 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl bg-muted" /><div className="h-52 animate-pulse rounded-2xl bg-muted" /></div>
          : status === "error" ? <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Live mover rankings are unavailable.</p>
            : <div className="grid gap-3 md:grid-cols-2"><MoverList title="Biggest gainers" markets={gainers} gainers /><MoverList title="Biggest decliners" markets={losers} gainers={false} /></div>}
      </div>
    </section>
  );
}

export function BitcoinMarketCard({ market, status }: { market?: MarketCoin; status: MarketStatus }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-xl shadow-foreground/5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">B</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Bitcoin <span className="ml-1 text-xs uppercase text-muted-foreground">BTC</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Seven-day market view</p>
          </div>
        </div>
        {status === "loading" ? <span className="h-6 w-16 animate-pulse rounded bg-muted" /> : <span className={`rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums ${changeTone(market?.price_change_percentage_24h)}`}>{formatPercent(market?.price_change_percentage_24h)}</span>}
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">{status === "loading" ? <span className="inline-block h-9 w-40 animate-pulse rounded bg-muted" /> : formatPrice(market?.current_price)}</p>
      <p className="mt-1 text-xs text-muted-foreground">24-hour change</p>
      <div className="mt-5 border-t border-border pt-3">
        {status === "loading" ? <div className="h-44 animate-pulse rounded bg-muted" /> : market ? <BitcoinChart market={market} /> : <p className="flex h-44 items-center justify-center text-sm text-muted-foreground">Chart data unavailable</p>}
      </div>
      {market && status === "ready" && (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          <p className="text-muted-foreground">24h high <span className="mt-1 block font-medium tabular-nums text-foreground">{formatPrice(market.high_24h)}</span></p>
          <p className="text-right text-muted-foreground">24h low <span className="mt-1 block font-medium tabular-nums text-foreground">{formatPrice(market.low_24h)}</span></p>
        </div>
      )}
      <Link href="/currency" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Open charts <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
