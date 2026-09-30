"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ChevronDown, Maximize2, RefreshCw, Search, SlidersHorizontal, Sparkles, Star, TrendingUp } from "lucide-react";
import { SUPPORTED_COINS } from "@/lib/constants";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type MarketSnapshot = { candles: Candle[]; price: number; change: number };
type LiveTicker = { price: number; change: number };
type Sentiment = { current?: { value: number; classification: string } };
const WATCHLIST = SUPPORTED_COINS.slice(0, 6);
const PERIODS = ["24H", "7D", "30D", "1Y"] as const;
type Period = (typeof PERIODS)[number];
const periodParams: Record<Period, { interval: string; limit: number }> = {
  "24H": { interval: "60", limit: 24 }, "7D": { interval: "1440", limit: 7 },
  "30D": { interval: "1440", limit: 30 }, "1Y": { interval: "1440", limit: 365 },
};

function formatPrice(price: number | undefined) {
  if (price === undefined || !Number.isFinite(price)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: price < 1 ? 4 : 2, maximumFractionDigits: price < 1 ? 6 : 2 }).format(price);
}
function formatCompact(price: number) { return price >= 1000 ? `$${(price / 1000).toFixed(2)}k` : price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(4)}`; }
function percent(value: number | undefined) { return value === undefined || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }

function CoinMark({ symbol }: { symbol: string }) {
  const tones: Record<string, string> = { BTC: "bg-[#f7931a]/15 text-[#f7931a]", ETH: "bg-[#8795f5]/15 text-[#9ba7ff]", SOL: "bg-[#14b8a6]/15 text-[#38d9bf]", XRP: "bg-white/10 text-white", ARB: "bg-[#5c9cff]/15 text-[#72aaff]", DOT: "bg-[#e6007a]/15 text-[#f158aa]" };
  return <span className={`coin-mark ${tones[symbol] ?? "bg-white/10 text-white"}`} aria-hidden="true">{symbol === "BTC" ? "₿" : symbol.slice(0, 1)}</span>;
}
function MiniSparkline({ candles, positive }: { candles: Candle[]; positive: boolean }) {
  if (candles.length < 2) return <span className="sparkline-empty" />;
  const values = candles.map((c) => c.close); const min = Math.min(...values); const range = Math.max(...values) - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${22 - ((v - min) / range) * 18}`).join(" ");
  return <svg viewBox="0 0 100 24" className="h-7 w-24" aria-label={positive ? "Price trending up" : "Price trending down"}><polyline points={points} fill="none" stroke={positive ? "#0ecb81" : "#f6465d"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function MarketDashboard() {
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [liveTickers, setLiveTickers] = useState<Record<string, LiveTicker>>({});
  const [tickerConnected, setTickerConnected] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(WATCHLIST[0]);
  const [period, setPeriod] = useState<Period>("7D");
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;

    const refreshLiveTickers = async () => {
      const startedAt = Date.now();
      try {
        const response = await fetch("/api/live-tickers", { cache: "no-store" });
        if (!response.ok) throw new Error("Live ticker request failed");
        const data = (await response.json()) as { tickers?: Record<string, LiveTicker> };
        if (!active) return;
        if (!data.tickers || Object.keys(data.tickers).length === 0) {
          throw new Error("Live ticker response was empty");
        }
        consecutiveFailures = 0;
        setLiveTickers(data.tickers);
        setTickerConnected(true);
      } catch {
        consecutiveFailures += 1;
        if (active) setTickerConnected(false);
      } finally {
        if (active) {
          const interval = consecutiveFailures
            ? Math.min(1000 * 2 ** consecutiveFailures, 30000)
            : 1000;
          refreshTimer = setTimeout(refreshLiveTickers, Math.max(0, interval - (Date.now() - startedAt)));
        }
      }
    };

    void refreshLiveTickers();
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadWatchlist = async () => {
      const results = await Promise.all(WATCHLIST.map(async (coin) => {
        try {
          const response = await fetch(`/api/prices?pair=${coin.krakenPair}&interval=1440&limit=30`);
          if (!response.ok) return null;
          const data = await response.json(); const candles: Candle[] = data.candles ?? [];
          if (!candles.length) return null;
          const first = candles[0].close; const last = candles[candles.length - 1].close;
          return [coin.id, { candles, price: last, change: first ? ((last - first) / first) * 100 : 0 }] as const;
        } catch { return null; }
      }));
      if (!active) return;
      setSnapshots(Object.fromEntries(results.filter((r): r is NonNullable<typeof r> => r !== null)));
    };
    const loadSentiment = async () => {
      try { const response = await fetch("/api/fear-greed"); if (response.ok && active) setSentiment(await response.json()); } catch { /* Keep sentiment unavailable when its data source is down. */ }
    };
    void loadWatchlist(); void loadSentiment();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadChart = async () => {
      setLoading(true); setChartError(false);
      try {
        if ((period === "7D" || period === "30D") && snapshots[selectedCoin.id]?.candles.length) {
          const saved = snapshots[selectedCoin.id].candles;
          setChartCandles(period === "7D" ? saved.slice(-7) : saved); setLoading(false); return;
        }
        const params = periodParams[period];
        const response = await fetch(`/api/prices?pair=${selectedCoin.krakenPair}&interval=${params.interval}&limit=${params.limit}`);
        if (!response.ok) throw new Error("Price history unavailable");
        const data = await response.json(); if (!active) return;
        setChartCandles(data.candles ?? []); setChartError(!data.candles?.length);
      } catch { if (active) { setChartCandles([]); setChartError(true); } }
      finally { if (active) setLoading(false); }
    };
    void loadChart(); return () => { active = false; };
  }, [period, selectedCoin, snapshots]);

  const current = snapshots[selectedCoin.id];
  const currentPrice = current?.price ?? chartCandles.at(-1)?.close;
  const chartStats = useMemo(() => {
    if (chartCandles.length < 2) return null;
    const first = chartCandles[0].close; const last = chartCandles.at(-1)!.close;
    return { change: first ? ((last - first) / first) * 100 : 0, high: Math.max(...chartCandles.map((c) => c.high)), low: Math.min(...chartCandles.map((c) => c.low)) };
  }, [chartCandles]);
  const chartGeometry = useMemo(() => {
    if (chartCandles.length < 2) return null;
    const width = 1000; const height = 300; const values = chartCandles.map((c) => c.close);
    const min = Math.min(...chartCandles.map((c) => c.low)); const max = Math.max(...chartCandles.map((c) => c.high));
    const padding = (max - min || 1) * .12; const floor = min - padding; const ceiling = max + padding;
    const points = values.map((value, index) => ({ x: (index / (values.length - 1)) * width, y: height - ((value - floor) / (ceiling - floor)) * height }));
    const line = points.map((p) => `${p.x},${p.y}`).join(" ");
    return { width, height, line, area: `${points[0].x},${height} ${line} ${points.at(-1)?.x},${height}`, min: floor, max: ceiling };
  }, [chartCandles]);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const params = periodParams[period];
      const response = await fetch(`/api/prices?pair=${selectedCoin.krakenPair}&interval=${params.interval}&limit=${params.limit}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed");
      const data = await response.json(); const candles: Candle[] = data.candles ?? []; setChartCandles(candles); setChartError(!candles.length);
      if (candles.length) { const first = candles[0].close; const last = candles.at(-1)!.close; setSnapshots((prev) => ({ ...prev, [selectedCoin.id]: { candles, price: last, change: first ? ((last - first) / first) * 100 : 0 } })); }
    } catch { setChartError(true); } finally { setRefreshing(false); }
  };

  const marketBreadth = Object.values(snapshots); const advancing = marketBreadth.filter((item) => item.change >= 0).length; const sentimentValue = sentiment?.current?.value;

  return (
    <main className="terminal-shell">
      <div className="ticker-strip" aria-label="Market watchlist">
        <div className="ticker-label"><span className="status-dot" style={tickerConnected ? undefined : { background: "#596371", boxShadow: "none" }} /> MARKET PULSE</div>
        <div className="ticker-items">{WATCHLIST.slice(0, 5).map((coin) => { const item = snapshots[coin.id]; const live = liveTickers[coin.symbol]; const positive = (live?.change ?? item?.change ?? 0) >= 0; return <button className="ticker-item" key={coin.id} onClick={() => setSelectedCoin(coin)}><span className="ticker-symbol">{coin.symbol}<span className="ticker-quote"> / {live ? "USDT" : "USD"}</span></span><span className="ticker-price">{formatPrice(live?.price ?? item?.price)}</span><span className={live || item ? (positive ? "positive" : "negative") : "text-muted-foreground"}>{percent(live?.change ?? item?.change)}</span></button>; })}</div>
        <span className="ticker-time">
          {tickerConnected
            ? "LIVE · 24H CHANGE"
            : Object.keys(liveTickers).length
              ? "LAST QUOTE · FEED PAUSED"
              : "30D change · connecting live"}
        </span>
      </div>
      <div className="terminal-content">
        <section className="overview-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR MARKET WORKSPACE</div><h1>Market overview</h1><p>Price action, market breadth, and research signals in one view.</p></div><div className="heading-actions"><span className="snapshot-label"><span className="status-dot" /> {Object.keys(snapshots).length ? "Market data connected" : "Connecting to market data"}</span><button className="terminal-button" onClick={refreshData} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button></div></section>
        <section className="metrics-grid" aria-label="Market summary">
          <article className="metric-card"><div className="metric-top"><span>Tracked assets</span><span className="metric-icon"><BarChart3 className="h-4 w-4" /></span></div><div className="metric-value">{WATCHLIST.length}<span className="metric-unit"> assets</span></div><div className="metric-foot"><span className="metric-foot-dot" /> Multi-asset coverage</div></article>
          <article className="metric-card"><div className="metric-top"><span>Market breadth</span><span className="metric-icon"><Activity className="h-4 w-4" /></span></div><div className="metric-value">{marketBreadth.length ? `${advancing} / ${marketBreadth.length}` : "—"}</div><div className="metric-foot">Assets positive over 30 days</div></article>
          <article className="metric-card"><div className="metric-top"><span>Fear &amp; greed</span><span className="metric-icon"><Sparkles className="h-4 w-4" /></span></div><div className="metric-value">{sentimentValue ?? "—"}<span className="metric-unit"> / 100</span></div><div className="metric-foot">{sentiment?.current?.classification ?? "Sentiment index"}</div></article>
          <article className="metric-card metric-card-accent"><div className="metric-top"><span>Research desk</span><span className="metric-icon"><TrendingUp className="h-4 w-4" /></span></div><div className="metric-value metric-value-small">Model insights</div><Link href="/currency" className="metric-link">Explore forecasts <ArrowRight className="h-3.5 w-3.5" /></Link></article>
        </section>
        <section className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel-heading chart-heading"><div className="asset-heading"><CoinMark symbol={selectedCoin.symbol} /><div><div className="asset-name-row"><h2>{selectedCoin.name}</h2><span className="asset-pair">{selectedCoin.symbol}/USD</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></div><div className="asset-price-row"><span className="asset-price">{formatPrice(currentPrice)}</span>{chartStats && <span className={chartStats.change >= 0 ? "change-pill positive-bg" : "change-pill negative-bg"}>{chartStats.change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{percent(chartStats.change)}</span>}</div></div></div><div className="chart-actions"><Link href="/currency" aria-label="Open market analysis" className="icon-button"><Search className="h-4 w-4" /></Link><Link href="/currency" aria-label="Chart settings" className="icon-button"><SlidersHorizontal className="h-4 w-4" /></Link><Link href="/currency" aria-label="Expand chart" className="icon-button"><Maximize2 className="h-4 w-4" /></Link></div></div>
            <div className="chart-subbar"><div className="chart-tabs"><button className="chart-tab active">Price</button><Link href="/currency" className="chart-tab">Technical analysis</Link><Link href="/currency" className="chart-tab">Forecast</Link></div><div className="period-tabs">{PERIODS.map((value) => <button key={value} onClick={() => setPeriod(value)} className={period === value ? "period-tab active" : "period-tab"}>{value}</button>)}</div></div>
            <div className="chart-stat-row"><div><span>High</span><b>{formatPrice(chartStats?.high)}</b></div><div><span>Low</span><b>{formatPrice(chartStats?.low)}</b></div><div><span>Window</span><b>{period}</b></div><div><span>Source</span><b>CoinGecko</b></div></div>
            <div className="chart-canvas">{loading ? <div className="chart-message"><Activity className="h-5 w-5 animate-pulse" /> Loading price history…</div> : chartGeometry ? <svg viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} preserveAspectRatio="none" className="price-chart" role="img" aria-label={`${selectedCoin.name} price chart over ${period}`}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0ecb81" stopOpacity=".2" /><stop offset="100%" stopColor="#0ecb81" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3, 4].map((line) => <line key={line} x1="0" x2="1000" y1={line * 75} y2={line * 75} className="chart-grid-line" />)}<polygon points={chartGeometry.area} fill="url(#chartFill)" /><polyline points={chartGeometry.line} fill="none" stroke="#0ecb81" strokeWidth="2.4" vectorEffect="non-scaling-stroke" /></svg> : <div className="chart-message">{chartError ? "Price history is temporarily unavailable." : "Waiting for price history…"}</div>}{chartGeometry && !loading && <div className="chart-y-labels"><span>{formatCompact(chartGeometry.max)}</span><span>{formatCompact((chartGeometry.max + chartGeometry.min) / 2)}</span><span>{formatCompact(chartGeometry.min)}</span></div>}<div className="chart-x-labels"><span>Start</span><span>Midpoint</span><span>Latest</span></div><div className="chart-watermark">INTELLITREX <span>MARKET DATA</span></div></div>
            <div className="chart-footer"><span><span className="status-dot" /> Data refreshes on request</span><Link href="/currency">Open full analysis <ArrowRight className="h-3 w-3" /></Link></div>
          </article>
          <aside className="panel watchlist-panel"><div className="panel-heading"><div><div className="panel-kicker">YOUR ASSETS</div><h2>Watchlist</h2></div><Link href="/currency" className="panel-manage-link">Manage <ArrowRight className="h-3 w-3" /></Link></div><div className="watchlist-columns"><span>Asset</span><span>Price / 30D</span><span>Trend</span></div><div className="watchlist-rows">{WATCHLIST.map((coin) => { const item = snapshots[coin.id]; const positive = (item?.change ?? 0) >= 0; return <button key={coin.id} className={`watchlist-row ${selectedCoin.id === coin.id ? "selected" : ""}`} onClick={() => setSelectedCoin(coin)}><span className="watch-asset"><CoinMark symbol={coin.symbol} /><span><b>{coin.symbol}</b><small>{coin.name}</small></span></span><span className="watch-quote"><b>{formatPrice(item?.price)}</b><small className={item ? (positive ? "positive" : "negative") : "text-muted-foreground"}>{percent(item?.change)}</small></span><MiniSparkline candles={item?.candles ?? []} positive={positive} /></button>; })}</div><Link href="/currency" className="panel-bottom-link">View all markets <ArrowRight className="h-3.5 w-3.5" /></Link></aside>
        </section>
        <section className="lower-grid">
          <article className="panel sentiment-panel"><div className="panel-heading"><div><div className="panel-kicker">CROWD POSITIONING</div><h2>Market sentiment</h2></div><span className="sentiment-badge">Fear &amp; Greed</span></div><div className="sentiment-content"><div className="sentiment-score"><span>{sentimentValue ?? "—"}</span><small>/ 100</small></div><div className="sentiment-meter"><span style={{ width: `${Math.max(0, Math.min(sentimentValue ?? 0, 100))}%` }} /></div><div className="sentiment-scale"><span>Fear</span><b>{sentiment?.current?.classification ?? "Loading index"}</b><span>Greed</span></div></div></article>
          <article className="research-card"><div className="research-glow" /><div className="research-top"><span className="research-icon"><Sparkles className="h-4 w-4" /></span><span className="research-label">INTELLITREX RESEARCH</span></div><h2>Turn market data<br />into a clearer view.</h2><p>Explore model forecasts and technical indicators for the assets you follow.</p><Link href="/currency" className="research-link">Open research desk <ArrowRight className="h-4 w-4" /></Link></article>
          <article className="panel advisor-panel"><div className="advisor-symbol"><Star className="h-4 w-4" /></div><div><div className="panel-kicker">AI MARKET ADVISOR</div><h2>Need a second perspective?</h2><p>Ask questions about market trends and crypto fundamentals.</p><Link href="/consultancy" className="advisor-link">Ask the AI advisor <ArrowRight className="h-3.5 w-3.5" /></Link></div></article>
        </section>
        <footer className="terminal-footer"><span>INTELLITREX <span className="footer-separator">/</span> Market intelligence workspace</span><span>Educational research only · Not financial advice</span></footer>
      </div>
    </main>
  );
}
