"use client";

import Link from "next/link";
import { MarketSignals } from "@/components/market-signals";
import {
  TrendingUp,
  Activity,
  Brain,
  Shield,
  LineChart,
  Bot,
  Wallet,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "Live Market Data",
    description:
      "Live cryptocurrency prices from CoinGecko. Track 10 major coins with interactive charts and hover details.",
  },
  {
    icon: Brain,
    title: "AI-Powered Forecasting",
    description:
      "4 ML models (XGBoost, Prophet, NHITS, GRU) ensembled for 7-day price predictions. Updated daily.",
  },
  {
    icon: Activity,
    title: "Market Signals",
    description:
      "Plain-language trend, RSI, and Fear & Greed signals for every coin, plus SMA and Bollinger Bands on the charts.",
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

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-3xl p-12 flex flex-col lg:flex-row items-center gap-12">
            <div className="w-full lg:w-5/12 aspect-[3/4] rounded-2xl bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
              <div className="absolute top-6 left-6 bg-card/90 backdrop-blur rounded-full px-4 py-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-accent rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-bold">*</span>
                </div>
                <span className="text-sm font-medium text-foreground">Intellitrex</span>
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
                THE{" "}
                <span className="inline-flex items-center justify-center w-12 h-12 bg-accent rounded-lg align-middle">
                  <TrendingUp className="w-6 h-6 text-white" />
                </span>{" "}
                PATH TO FINANCIAL EMPOWERMENT
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                Empower your trades with real-time insights and data-driven decisions.
                Maximize opportunities and navigate markets confidently with intelligent
                trading analysis.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/currency"
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
                <Link
                  href="/consultancy"
                  className="inline-flex items-center justify-center px-8 py-3.5 border border-border rounded-full font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Talk to AI Advisor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketSignals />

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything You Need for Informed Trading
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining cutting-edge machine learning with real-time market data to give you
              an analytical edge.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-card rounded-2xl p-8 border border-border hover:border-primary/30 transition-colors"
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
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Explore Markets",
                desc: "Browse live prices, charts, and market signals for 10 major cryptocurrencies.",
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
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Trade Smarter?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start exploring AI-powered market insights and make data-driven decisions today.
          </p>
          <Link
            href="/currency"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
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
              className="text-primary hover:underline"
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
