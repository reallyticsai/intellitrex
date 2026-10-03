"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Bot, ChartNoAxesCombined, RefreshCw } from "lucide-react";
import {
  BitcoinMarketCard,
  MarketSummary,
  TickerStrip,
  TopMovers,
  type MarketCoin,
} from "@/components/home/market-components";

type MarketStatus = "loading" | "ready" | "error";

let marketRequest: Promise<MarketCoin[]> | null = null;

function fetchMarketsOnce() {
  if (!marketRequest) {
    marketRequest = fetch("/api/markets")
      .then(async (response) => {
        if (!response.ok) throw new Error("Market data request failed");
        const markets = (await response.json()) as MarketCoin[];
        if (!Array.isArray(markets) || markets.length !== 10) {
          throw new Error("Market data response was incomplete");
        }
        return markets;
      })
      .finally(() => {
        marketRequest = null;
      });
  }
  return marketRequest;
}

const FEATURES = [
  {
    icon: ChartNoAxesCombined,
    title: "Read the price action",
    description: "Explore market charts with technical indicators and forecast views.",
    href: "/currency",
  },
  {
    icon: Activity,
    title: "Check market sentiment",
    description: "Use the Fear & Greed index alongside price history for broader context.",
    href: "/currency",
  },
  {
    icon: Bot,
    title: "Ask the AI advisor",
    description: "Talk through crypto concepts and market context in an advisor conversation.",
    href: "/consultancy",
  },
];

export default function LandingPage() {
  const [markets, setMarkets] = useState<MarketCoin[]>([]);
  const [status, setStatus] = useState<MarketStatus>("loading");

  useEffect(() => {
    let active = true;
    void fetchMarketsOnce()
      .then((data) => {
        if (!active) return;
        setMarkets(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setMarkets([]);
        setStatus("error");
      });
    return () => { active = false; };
  }, []);

  function retryMarkets() {
    setStatus("loading");
    void fetchMarketsOnce()
      .then((data) => {
        setMarkets(data);
        setStatus("ready");
      })
      .catch(() => {
        setMarkets([]);
        setStatus("error");
      });
  }

  const bitcoin = markets.find((market) => market.id === "bitcoin");

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <TickerStrip markets={markets} status={status} />

      {status === "error" && (
        <div role="alert" className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-10">
          <p className="text-sm font-medium text-danger">Market data unavailable.</p>
          <button type="button" onClick={retryMarkets} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/50">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      <section className="mx-auto grid max-w-[1360px] items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.9fr] lg:gap-12 lg:px-10 lg:py-16">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Crypto markets, made clearer
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            A clearer view of the crypto market.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Follow live prices, compare market moves, and explore context for your next research session.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/currency" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Open charts <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/consultancy" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              Ask the AI advisor
            </Link>
          </div>
        </div>
        <BitcoinMarketCard market={bitcoin} status={status} />
      </section>

      <MarketSummary markets={markets} status={status} />
      <TopMovers markets={markets} status={status} />

      <section className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">The IntelliTrex toolkit</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Market context for every check-in</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1360px] px-4 pb-10 sm:px-6 sm:pb-14 lg:px-10">
        <div className="flex flex-col gap-5 rounded-3xl bg-foreground px-5 py-7 text-background sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-9">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Keep exploring</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Bring more context to your market research.</h2>
            <p className="mt-2 text-sm opacity-70">Open a chart and explore price history, indicators, and sentiment.</p>
          </div>
          <Link href="/currency" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground transition-opacity hover:opacity-90">
            Explore charts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <footer className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
          <p className="max-w-5xl">
            <strong className="font-semibold text-foreground">Disclaimer:</strong> IntelliTrex is a research and analytics platform for educational purposes. We do not provide financial advice. All trading and investment decisions are made at your own risk. Cryptocurrency markets are volatile and past performance does not guarantee future results. Always do your own research before making investment decisions. By using this platform, you acknowledge that IntelliTrex and Reallytics AI are not responsible for any financial losses.
          </p>
        </footer>
      </section>
    </main>
  );
}
