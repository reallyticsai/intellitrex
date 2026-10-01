"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Signal, SignalDirection } from "@/lib/signals";
import { cn } from "@/lib/utils";

type CoinSignals =
  | { symbol: string; name: string; available: false }
  | {
      symbol: string;
      name: string;
      available: true;
      price: number;
      change7d: number | null;
      trend: Signal | null;
      rsi: Signal | null;
    };

type SignalsResponse = {
  fearGreed: { value: number; classification: string; signal: Signal } | null;
  coins: CoinSignals[];
  generatedAt: number;
};

const DIRECTION_STYLES: Record<SignalDirection, string> = {
  bullish: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
  bearish: "bg-danger/10 text-danger",
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function SignalBadge({ signal, prefix }: { signal: Signal; prefix?: string }) {
  return (
    <span
      title={signal.reason}
      className={cn("px-2 py-0.5 rounded-full text-xs font-medium", DIRECTION_STYLES[signal.direction])}
    >
      {prefix ? `${prefix}: ` : ""}
      {signal.label}
    </span>
  );
}

function TrendIcon({ direction }: { direction: SignalDirection }) {
  if (direction === "bullish") return <TrendingUp className="w-4 h-4 text-success" />;
  if (direction === "bearish") return <TrendingDown className="w-4 h-4 text-danger" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function MarketSignals() {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/signals")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <section className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Market Signals</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mt-1">
              Today across 10 major cryptocurrencies
            </h2>
          </div>
          <Link
            href="/currency"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open full charts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
            Market signals are unavailable right now. Please try again shortly.
          </div>
        )}

        {!error && !data && (
          <div className="bg-card rounded-2xl border border-border p-12 flex items-center justify-center">
            <Activity className="w-8 h-8 text-muted-foreground animate-pulse" />
          </div>
        )}

        {data && (
          <div className="grid lg:grid-cols-4 gap-4">
            {data.fearGreed && (
              <div className="bg-card rounded-2xl border border-border p-6 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Fear &amp; Greed</p>
                  <p className="text-5xl font-bold text-foreground mt-3">{data.fearGreed.value}</p>
                  <div className="mt-3">
                    <SignalBadge signal={data.fearGreed.signal} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  {data.fearGreed.signal.reason}.
                </p>
              </div>
            )}

            <div
              className={cn(
                "grid sm:grid-cols-2 xl:grid-cols-3 gap-3",
                data.fearGreed ? "lg:col-span-3" : "lg:col-span-4"
              )}
            >
              {data.coins.map((coin) => (
                <div key={coin.symbol} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{coin.symbol[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{coin.symbol}</p>
                        <p className="text-xs text-muted-foreground">{coin.name}</p>
                      </div>
                    </div>
                    {coin.available && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatPrice(coin.price)}</p>
                        {coin.change7d !== null && (
                          <p
                            className={cn(
                              "text-xs font-medium",
                              coin.change7d >= 0 ? "text-success" : "text-danger"
                            )}
                          >
                            {coin.change7d >= 0 ? "+" : ""}
                            {coin.change7d.toFixed(1)}% 7d
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {coin.available ? (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {coin.trend && <TrendIcon direction={coin.trend.direction} />}
                      {coin.trend && <SignalBadge signal={coin.trend} />}
                      {coin.rsi && <SignalBadge signal={coin.rsi} prefix="RSI" />}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-3">Data temporarily unavailable</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Signals are computed from 30 days of CoinGecko price data and refresh every 15 minutes.
          Not financial advice.
        </p>
      </div>
    </section>
  );
}
