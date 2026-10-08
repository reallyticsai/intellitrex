"use client";

import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Brain,
  Shield,
  LineChart,
  Bot,
  Wallet,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "Live Market Data",
    description:
      "Real-time cryptocurrency prices powered by Kraken exchange. Track 12+ coins with professional-grade charting.",
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
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Preview</span>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Market overview</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><TrendingUp className="size-3.5" aria-hidden="true" /> Price + forecast</span>
                </div>
                <svg viewBox="0 0 420 180" className="mt-4 w-full text-primary" role="img" aria-labelledby="market-preview-title">
                  <title id="market-preview-title">Illustrative price chart with a dashed forecast. This is not live market data.</title>
                  <defs>
                    <linearGradient id="market-preview-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[35, 80, 125, 170].map((y) => <line key={y} x1="0" y1={y} x2="420" y2={y} stroke="currentColor" strokeOpacity="0.1" />)}
                  <path d="M0 140 L25 125 L50 132 L75 105 L100 117 L125 90 L150 97 L175 67 L200 82 L225 58 L250 66 L275 40 L290 48 L290 180 L0 180 Z" fill="url(#market-preview-fill)" />
                  <path d="M0 140 L25 125 L50 132 L75 105 L100 117 L125 90 L150 97 L175 67 L200 82 L225 58 L250 66 L275 40 L290 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  <line x1="290" y1="10" x2="290" y2="170" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 5" />
                  <path d="M290 48 L315 40 L340 47 L365 25 L390 31 L420 15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
                  <circle cx="290" cy="48" r="5" fill="currentColor" stroke="var(--card)" strokeWidth="3" />
                </svg>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Price history</span>
                  <span>7-day forecast</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div className="rounded-lg bg-muted/70 p-3">
                    <Brain className="mb-2 size-4 text-primary" aria-hidden="true" />
                    <p className="text-xs font-semibold text-foreground">AI forecasts</p>
                    <p className="mt-1 text-xs text-muted-foreground">Multiple model perspectives</p>
                  </div>
                  <div className="rounded-lg bg-muted/70 p-3">
                    <BarChart3 className="mb-2 size-4 text-primary" aria-hidden="true" />
                    <p className="text-xs font-semibold text-foreground">Technical indicators</p>
                    <p className="mt-1 text-xs text-muted-foreground">Context behind each move</p>
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-muted-foreground">Illustrative preview · Not live market data</figcaption>
            </figure>
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
