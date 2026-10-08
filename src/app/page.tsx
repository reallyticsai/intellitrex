"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateSma20Signal, type Sma20Signal } from "@/lib/signals";
import {
  BarChart3,
  Brain,
  Shield,
  LineChart,
  Bot,
  Wallet,
  ArrowRight,
  Sparkles,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "Live Market Data",
    description:
      "Cryptocurrency prices powered by CoinGecko. Explore supported coins with professional-grade charting.",
  },
  {
    icon: Brain,
    title: "AI-Powered Forecasting",
    description:
      "4 ML models (XGBoost, Prophet, NHITS, GRU) ensembled for 7-day price predictions. Updated daily.",
  },
  {
    icon: BarChart3,
    title: "Technical Analysis",
    description:
      "Built-in indicators — SMA, RSI, Bollinger Bands, volatility scoring, and Fear & Greed Index.",
  },
  {
    icon: Bot,
    title: "AI Trading Consultant",
    description:
      "Chat with an AI advisor in 3 modes: Risk-Averse, Active Trader, or Learning. Personalized insights.",
  },
  {
    icon: Wallet,
    title: "Portfolio Analysis",
    description:
      "Connect your Binance account for automated investment analysis. See forecasts mapped to your holdings.",
  },
  {
    icon: Shield,
    title: "Research-Driven",
    description:
      "Built on peer-reviewed research methodologies. Fear & Greed sentiment, multi-model consensus approach.",
  },
];

const COINS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "ARB", name: "Arbitrum" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "KSM", name: "Kusama" },
  { symbol: "PYTH", name: "Pyth" },
  { symbol: "SUI", name: "Sui" },
];

type MarketState = {
  status: "loading" | "ready" | "unavailable";
  signal: Sma20Signal | null;
};

const formatPrice = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
}).format(value);

function BitcoinSignal() {
  const [market, setMarket] = useState<MarketState>({ status: "loading", signal: null });
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchMarket() {
      try {
        const response = await fetch("/api/prices?pair=XXBTZUSD&interval=1440&limit=30", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Market request failed");
        const data = await response.json();
        const signal = calculateSma20Signal(data?.candles);
        if (!controller.signal.aborted) {
          setMarket({ status: signal ? "ready" : "unavailable", signal });
        }
      } catch {
        if (!controller.signal.aborted) setMarket({ status: "unavailable", signal: null });
      }
    }
    void fetchMarket();
    return () => controller.abort();
  }, [refreshVersion]);

  const refresh = () => {
    setMarket({ status: "loading", signal: null });
    setRefreshVersion((version) => version + 1);
  };

  const { signal, status } = market;
  const color = signal?.classification === "Above average" ? "text-emerald-700 [.dark_&]:text-emerald-400"
    : signal?.classification === "Below average" ? "text-red-700 [.dark_&]:text-red-400" : "text-primary";

  // A minimum range keeps a flat price series visible and avoids division by zero.
  const closes = signal?.candles.map((candle) => candle.close) ?? [];
  const min = signal ? Math.min(...closes, signal.sma20) : 0;
  const max = signal ? Math.max(...closes, signal.sma20) : 0;
  const padding = Math.max((max - min) * 0.15, max * 0.001);
  const range = max - min + padding * 2;
  const toY = (price: number) => 170 - ((price - min + padding) / range) * 160;
  const points = closes.map((price, index) => `${10 + (index / 19) * 400},${toY(price)}`).join(" ");
  const dateLabel = (time: number) => new Date(time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <figure className="min-w-0 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-muted/60 to-accent/10 p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">B</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Bitcoin</p>
              <p className="text-xs text-muted-foreground">BTC / USD</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={status === "loading"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {status === "unavailable" ? "Retry" : "Refresh"}
          </button>
        </div>

        <div aria-live="polite" aria-atomic="true" aria-busy={status === "loading"} className="min-h-[300px] pt-5">
          <h2 className="text-sm font-semibold text-foreground">Price versus SMA20</h2>
          {status === "loading" && (
            <div className="flex min-h-[270px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
              <LineChart className="size-8 text-primary" aria-hidden="true" />
              Loading Bitcoin market data…
            </div>
          )}
          {status === "unavailable" && (
            <div className="flex min-h-[270px] flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Unavailable</p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">We need 20 valid candles to calculate this signal. Market data could not be loaded or is incomplete.</p>
              <button type="button" onClick={refresh} className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Try again</button>
            </div>
          )}
          {status === "ready" && signal && (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full bg-muted px-3 py-1.5 text-xs font-semibold ${color}`}>{signal.classification}</span>
                <span className={`text-sm font-semibold tabular-nums ${color}`}>{signal.deviation > 0 ? "+" : ""}{signal.deviation.toFixed(2)}% vs SMA20</span>
              </div>
              <svg viewBox="0 0 420 180" className="mt-4 w-full text-primary" role="img" aria-labelledby="bitcoin-signal-chart-title">
                <title id="bitcoin-signal-chart-title">Bitcoin closing prices for the latest 20 candles, compared with their average of {formatPrice(signal.sma20)}.</title>
                {[10, 50, 90, 130, 170].map((y) => <line key={y} x1="10" y1={y} x2="410" y2={y} stroke="currentColor" strokeOpacity="0.1" />)}
                <line x1="10" y1={toY(signal.sma20)} x2="410" y2={toY(signal.sma20)} stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 5" />
                <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx="410" cy={toY(signal.latestClose)} r="4" fill="currentColor" />
              </svg>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{dateLabel(signal.candles[0].time)}</span><span>{dateLabel(signal.timestamp)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> Closing price</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-accent" /> SMA20 reference</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div className="min-w-0 rounded-lg bg-muted/70 p-3"><dt className="text-xs text-muted-foreground">Latest close</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums text-foreground sm:text-lg">{formatPrice(signal.latestClose)}</dd></div>
                <div className="min-w-0 rounded-lg bg-muted/70 p-3"><dt className="text-xs text-muted-foreground">20-candle average</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums text-foreground sm:text-lg">{formatPrice(signal.sma20)}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Latest candle: <time dateTime={new Date(signal.timestamp * 1000).toISOString()}>{new Date(signal.timestamp * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time></p>
            </>
          )}
        </div>
      </div>
      <figcaption className="mt-3 space-y-1 text-center text-xs leading-relaxed text-muted-foreground">
        <p>20 returned candles · Candle spacing may vary.</p>
        <p>±1% is near average. An indicator, not a buy/sell recommendation.</p>
        <p>CoinGecko · Market data may be cached for 60 seconds.</p>
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid items-center gap-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10 lg:grid-cols-2 lg:gap-12 lg:p-12">
            <div className="min-w-0">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary sm:text-sm">
                <Sparkles className="size-4" aria-hidden="true" />
                AI-powered crypto insights
              </p>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
                A clearer view.<br />
                <span className="text-primary">A smarter trade.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Bring live market data, AI forecasts, and technical analysis together.
                Understand the market before your next move.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/currency"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  Explore Markets <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/consultancy"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  Talk to AI Advisor
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" aria-hidden="true" /> Live market data</span>
                <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" aria-hidden="true" /> 4 forecast models</span>
                <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" aria-hidden="true" /> 7-day outlook</span>
              </div>
            </div>

            <BitcoinSignal />
          </div>
        </div>
      </section>

      {/* Supported Coins */}
      <section className="px-4 pb-10 sm:px-6 sm:pb-12">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-muted-foreground mb-6 uppercase tracking-wider">
            Supported Cryptocurrencies
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 lg:grid-cols-10">
            {COINS.map((coin) => (
              <div
                key={coin.symbol}
                className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-xs font-bold text-primary">{coin.symbol[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{coin.symbol}</p>
                  <p className="text-[11px] text-muted-foreground">{coin.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-7xl mx-auto">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything You Need for Informed Trading
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining cutting-edge machine learning with real-time market data to give you
              an analytical edge.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-card/50 px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground md:text-4xl">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Explore Markets",
                desc: "Browse live prices, charts, and technical indicators for 12+ cryptocurrencies.",
              },
              {
                step: "02",
                title: "View AI Forecasts",
                desc: "See 7-day price predictions from our ensemble of 4 ML models updated daily.",
              },
              {
                step: "03",
                title: "Get Personalized Advice",
                desc: "Connect your portfolio and chat with our AI advisor for tailored insights.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <span className="text-xl font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Trade Smarter?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start exploring AI-powered market insights and make data-driven decisions today.
          </p>
          <Link
            href="/currency"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Launch Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Disclaimer:</strong> Intellitrex is a research and analytics platform for
            educational purposes. We do not provide financial advice. All trading and
            investment decisions are made at your own risk. Cryptocurrency markets are
            volatile and past performance does not guarantee future results. Always do your
            own research before making investment decisions. By using this platform, you
            acknowledge that Intellitrex and Reallytics AI are not responsible for any
            financial losses.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Built by{" "}
            <a
              href="https://github.com/reallyticsai"
              className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reallytics AI
            </a>{" "}
            &middot; {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </div>
  );
}
