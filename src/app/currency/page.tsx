"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { SUPPORTED_COINS } from "@/lib/constants";
import { bollinger, logReturnStats, probabilityUp, projectionCone, rsi, sma, summarize, type ProjectionPoint } from "@/lib/signals";
import { cn } from "@/lib/utils";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type FearGreed = { current: { value: number }; yesterday: { value: number }; lastWeek: { value: number }; lastMonth: { value: number } };
type DailyPoint = Candle & { sma20?: number; sma50?: number; rsi14?: number; upper?: number; middle?: number; lower?: number };

const TIME_RANGES = [
  { label: "24H", interval: "60", limit: 24 }, { label: "1W", interval: "1440", limit: 7 },
  { label: "1M", interval: "1440", limit: 30 }, { label: "1Y", interval: "1440", limit: 365 }, { label: "ALL", interval: "1440", limit: 720 },
];
const DAY_SECONDS = 86400;
const dayKey = (time: number) => Math.floor(time / DAY_SECONDS);
function formatPrice(value: number) { return value >= 1000 ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`; }
function formatPercent(value: number | undefined) { return value === undefined || !Number.isFinite(value) ? "--" : `${(value * 100).toFixed(1)}%`; }

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const tone = value <= 25 ? "bg-danger text-white" : value <= 45 ? "bg-red-300 text-red-900" : value <= 55 ? "bg-yellow-300 text-yellow-900" : value <= 75 ? "bg-green-300 text-green-900" : "bg-success text-white";
  return <div className={cn("rounded-xl p-3 text-center min-w-[100px]", tone)}><p className="text-xs font-medium opacity-80">{label}</p><p className="text-xl font-bold">{value}%</p></div>;
}

export default function CurrencyPage() {
  const [selectedCoin, setSelectedCoin] = useState(SUPPORTED_COINS[0] as (typeof SUPPORTED_COINS)[number]);
  const [timeRange, setTimeRange] = useState(TIME_RANGES[1]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dailyCandles, setDailyCandles] = useState<Candle[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [showSma, setShowSma] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [showCone, setShowCone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/prices?pair=${selectedCoin.krakenPair}&interval=${timeRange.interval}&limit=${timeRange.limit}`);
      setCandles((await response.json()).candles || []);
    } catch (error) { console.error("Failed to fetch prices", error); setCandles([]); }
    finally { setLoading(false); }
  }, [selectedCoin, timeRange]);
  const fetchDaily = useCallback(async () => {
    try {
      const response = await fetch(`/api/prices?pair=${selectedCoin.krakenPair}&resolution=daily&limit=365`);
      setDailyCandles((await response.json()).candles || []);
    } catch (error) { console.error("Failed to fetch daily prices", error); setDailyCandles([]); }
  }, [selectedCoin]);
  const fetchFearGreed = useCallback(async () => {
    try { setFearGreed(await (await fetch("/api/fear-greed")).json()); }
    catch (error) { console.error("Failed to fetch fear & greed", error); }
  }, []);
  useEffect(() => { fetchCandles(); }, [fetchCandles]);
  useEffect(() => { fetchDaily(); }, [fetchDaily]);
  useEffect(() => { fetchFearGreed(); }, [fetchFearGreed]);

  const signals = useMemo(() => {
    const closes = dailyCandles.map((candle) => candle.close);
    const sma20 = sma(closes, 20), sma50 = sma(closes, 50), bands = bollinger(closes, 20), rsi14 = rsi(closes, 14);
    const points: DailyPoint[] = dailyCandles.map((candle, index) => ({ ...candle, sma20: sma20[index - 19], sma50: sma50[index - 49], rsi14: rsi14[index - 14], upper: bands.upper[index - 19], middle: bands.middle[index - 19], lower: bands.lower[index - 19] }));
    const latest = points.at(-1);
    const stats = logReturnStats(closes, 90);
    const chanceUp = stats ? probabilityUp(stats.mu, stats.sigma) : undefined;
    const cone = latest && stats ? projectionCone(latest.close, stats.mu, stats.sigma) : [];
    const crossovers = points.filter((point, index) => {
      const prior = points[index - 1];
      return !!prior && point.sma20 !== undefined && point.sma50 !== undefined && prior.sma20 !== undefined && prior.sma50 !== undefined && ((point.sma20 > point.sma50 && prior.sma20 <= prior.sma50) || (point.sma20 < point.sma50 && prior.sma20 >= prior.sma50));
    });
    return { points, latest, chanceUp, cone, crossovers, summary: summarize({ close: latest?.close, sma20: latest?.sma20, sma50: latest?.sma50, rsi14: latest?.rsi14, bollinger: latest?.upper !== undefined && latest.lower !== undefined ? { upper: latest.upper, lower: latest.lower } : undefined, probabilityUp: chanceUp }) };
  }, [dailyCandles]);

  const latest = candles.at(-1), first = candles[0];
  const priceChange = latest && first ? ((latest.close - first.close) / first.close) * 100 : 0;
  const canDrawDaily = timeRange.label !== "24H";
  const byDay = useMemo(() => new Map(signals.points.map((point) => [dayKey(point.time), point])), [signals.points]);
  const visible = canDrawDaily ? candles.map((candle, index) => ({ index, point: byDay.get(dayKey(candle.time)) })).filter((item): item is { index: number; point: DailyPoint } => item.point !== undefined) : [];

  const svgW = 700, svgH = 340, padL = 70, padR = 10, padT = 10, padB = 30;
  const chartW = svgW - padL - padR, chartH = svgH - padT - padB;
  const cone: ProjectionPoint[] = showCone ? signals.cone : [];
  const prices = [...candles.flatMap((candle) => [candle.low, candle.high]), ...(showBollinger ? visible.flatMap(({ point }) => [point.upper, point.lower]).filter((value): value is number => value !== undefined) : []), ...cone.flatMap((point) => [point.lower95, point.upper95])];
  const minPrice = prices.length ? Math.min(...prices) * 0.995 : 0, maxPrice = prices.length ? Math.max(...prices) * 1.005 : 1, priceRange = maxPrice - minPrice || 1;
  const count = candles.length + cone.length;
  const toX = (index: number) => padL + (index / Math.max(count - 1, 1)) * chartW;
  const toY = (value: number) => padT + chartH - ((value - minPrice) / priceRange) * chartH;
  const priceLine = candles.map((candle, index) => `${toX(index)},${toY(candle.close)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => minPrice + index * priceRange / 4);
  const rsiTop = padT + chartH * .72, rsiBottom = padT + chartH - 4;
  const toRsiY = (value: number) => rsiBottom - value / 100 * (rsiBottom - rsiTop);
  const crossovers = signals.crossovers.map((point) => {
    const found = visible.find((item) => dayKey(item.point.time) === dayKey(point.time));
    return found ? { index: found.index, point } : null;
  }).filter((item): item is { index: number; point: DailyPoint } => item !== null);
  const mouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (candles.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * svgW;
    if (x < padL || x > toX(candles.length - 1)) return setHoverIdx(null);
    setHoverIdx(Math.round((x - padL) / (toX(candles.length - 1) - padL) * (candles.length - 1)));
  };
  const hover = hoverIdx === null ? undefined : candles[hoverIdx];

  return <div className="min-h-screen py-8 px-6"><div className="max-w-7xl mx-auto">
    <h1 className="text-3xl font-bold text-foreground mb-8">Currency</h1>
    <div className="grid lg:grid-cols-5 gap-6"><div className="lg:col-span-3 space-y-6">
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div><label className="text-sm text-muted-foreground">Select Currency</label><select value={selectedCoin.id} onChange={(event) => { const coin = SUPPORTED_COINS.find((candidate) => candidate.id === event.target.value); if (coin) setSelectedCoin(coin); }} className="ml-3 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm">{SUPPORTED_COINS.map((coin) => <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>)}</select></div><div className="flex items-center gap-1 bg-muted rounded-lg p-1">{TIME_RANGES.map((range) => <button key={range.label} onClick={() => setTimeRange(range)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium", range.label === timeRange.label ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{range.label}</button>)}</div></div>
        {latest && <div className="flex items-center gap-3 mb-4"><span className={cn("px-3 py-1 rounded-full text-xs font-medium", priceChange >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{priceChange >= 0 ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}{priceChange.toFixed(1)}%</span><span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">{formatPrice(latest.close)}</span></div>}
        <div className="relative w-full bg-muted/30 rounded-xl overflow-hidden" style={{ aspectRatio: `${svgW}/${svgH}` }}>{loading ? <div className="absolute inset-0 flex items-center justify-center"><Activity className="w-8 h-8 text-muted-foreground animate-pulse" /></div> : <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" onMouseMove={mouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {yTicks.map((price, index) => <g key={index}><line x1={padL} y1={toY(price)} x2={svgW - padR} y2={toY(price)} stroke="currentColor" strokeOpacity="0.08" /><text x={padL - 6} y={toY(price) + 3} textAnchor="end" fill="currentColor" fillOpacity="0.4" fontSize="9">{formatPrice(price)}</text></g>)}
          {showRsi && visible.length > 1 && <g><rect x={padL} y={rsiTop} width={toX(candles.length - 1) - padL} height={rsiBottom - rsiTop} fill="currentColor" fillOpacity=".03" /><line x1={padL} x2={toX(candles.length - 1)} y1={toRsiY(70)} y2={toRsiY(70)} stroke="#ef4444" strokeDasharray="3 2" /><line x1={padL} x2={toX(candles.length - 1)} y1={toRsiY(30)} y2={toRsiY(30)} stroke="#22c55e" strokeDasharray="3 2" /><polyline points={visible.filter(({ point }) => point.rsi14 !== undefined).map(({ index, point }) => `${toX(index)},${toRsiY(point.rsi14!)}`).join(" ")} fill="none" stroke="#3b82f6" strokeWidth="1.2" /><text x={padL + 4} y={rsiTop + 10} fill="#3b82f6" fontSize="8">RSI 14</text></g>}
          {showBollinger && visible.length > 1 && (() => { const data = visible.filter(({ point }) => point.upper !== undefined && point.lower !== undefined); const upper = data.map(({ index, point }) => `${toX(index)},${toY(point.upper!)}`), lower = data.map(({ index, point }) => `${toX(index)},${toY(point.lower!)}`); return <g><polygon points={[...upper, ...lower.reverse()].join(" ")} fill="#a78bfa" fillOpacity=".08" /><polyline points={upper.join(" ")} fill="none" stroke="#a78bfa" strokeWidth="1.1" /><polyline points={lower.reverse().join(" ")} fill="none" stroke="#a78bfa" strokeWidth="1.1" /></g>; })()}
          {cone.length > 0 && latest && (() => { const start = `${toX(candles.length - 1)},${toY(signals.latest?.close ?? latest.close)}`; const points = (key: keyof ProjectionPoint) => cone.map((point, index) => `${toX(candles.length + index)},${toY(point[key] as number)}`); const up95 = points("upper95"), low95 = points("lower95"), up68 = points("upper68"), low68 = points("lower68"), median = points("median"); return <g><polygon points={[start, ...up95, ...low95.reverse()].join(" ")} fill="#5b7cfa" fillOpacity=".09" /><polygon points={[start, ...up68, ...low68.reverse()].join(" ")} fill="#5b7cfa" fillOpacity=".18" /><polyline points={[start, ...median].join(" ")} fill="none" stroke="#5b7cfa" strokeWidth="1.5" strokeDasharray="5 3" /><text x={toX(candles.length + 1)} y={padT + 12} fill="#5b7cfa" fontSize="8">7d probability cone</text></g>; })()}
          {priceLine && <><defs><linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity=".15" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs><polygon points={`${priceLine} ${toX(candles.length - 1)},${padT + chartH} ${toX(0)},${padT + chartH}`} fill="url(#priceGrad)" /><polyline points={priceLine} fill="none" stroke="#22c55e" strokeWidth="2" /></>}
          {showSma && visible.length > 1 && <>{(["sma20", "sma50"] as const).map((key, index) => <polyline key={key} points={visible.filter(({ point }) => point[key] !== undefined).map(({ index: pointIndex, point }) => `${toX(pointIndex)},${toY(point[key]!)}`).join(" ")} fill="none" stroke={index === 0 ? "#f59e0b" : "#ec4899"} strokeWidth="1.4" strokeDasharray={index ? "4 2" : undefined} />)}{crossovers.map(({ index, point }) => <circle key={point.time} cx={toX(index)} cy={toY(point.sma20!)} r="4" fill={point.sma20! > point.sma50! ? "#22c55e" : "#ef4444"} stroke="white" />)}</>}
          {hover && hoverIdx !== null && <><line x1={toX(hoverIdx)} x2={toX(hoverIdx)} y1={padT} y2={padT + chartH} stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 3" /><circle cx={toX(hoverIdx)} cy={toY(hover.close)} r="4" fill="#22c55e" stroke="white" /><text x={toX(hoverIdx)} y={Math.max(toY(hover.close) - 8, padT + 10)} textAnchor="middle" fill="currentColor" fontSize="10">{formatPrice(hover.close)}</text></>}
        </svg>}</div>
        <div className="flex flex-wrap gap-3 mt-4">{[{ label: "SMA crossover", active: showSma, toggle: () => setShowSma(!showSma), color: "bg-yellow-500" }, { label: "Bollinger", active: showBollinger, toggle: () => setShowBollinger(!showBollinger), color: "bg-purple-500" }, { label: "RSI", active: showRsi, toggle: () => setShowRsi(!showRsi), color: "bg-blue-500" }, { label: "Probability cone", active: showCone, toggle: () => setShowCone(!showCone), color: "bg-indigo-500" }].map((item) => <button key={item.label} onClick={item.toggle} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border", item.active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}><span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", item.color)} />{item.label}</button>)}</div>
      </div>
      <div className="bg-card rounded-2xl p-6 border border-border"><h3 className="font-semibold text-foreground mb-4">Bollinger Bands</h3><div className="grid grid-cols-3 gap-4">{[{ label: "Upper Bound", value: signals.latest?.upper }, { label: "20 Period SMA", value: signals.latest?.middle }, { label: "Lower Bound", value: signals.latest?.lower }].map((band) => <div key={band.label}><p className="text-xs text-muted-foreground">{band.label}</p><p className="text-lg font-semibold text-foreground">{band.value === undefined ? "--" : formatPrice(band.value)}</p></div>)}</div></div>
      <div className="bg-card rounded-2xl p-6 border border-border"><h3 className="font-semibold text-foreground mb-2">RSI (14)</h3><span className="text-2xl font-bold text-foreground">{signals.latest?.rsi14?.toFixed(1) ?? "--"}</span></div>
    </div>
    <div className="lg:col-span-2 space-y-6">
      <div className="bg-card rounded-2xl p-6 border border-border"><h3 className="font-semibold text-foreground mb-4">Price</h3><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-success/10 p-4 text-center"><p className="text-xl font-bold text-success">{latest ? formatPrice(latest.close) : "--"}</p><p className="text-xs text-muted-foreground mt-1">Current Price</p></div><div className={cn("rounded-xl p-4 text-center", priceChange >= 0 ? "bg-success/10" : "bg-danger/10")}><p className={cn("text-xl font-bold", priceChange >= 0 ? "text-success" : "text-danger")}>{priceChange.toFixed(2)}%</p><p className="text-xs text-muted-foreground mt-1">Change</p></div><div className="rounded-xl border border-border p-4 text-center"><p className="text-lg font-semibold text-foreground">{formatPrice(candles.length ? Math.max(...candles.map((candle) => candle.high)) : 0)}</p><p className="text-xs text-muted-foreground mt-1">Highest</p></div><div className="rounded-xl border border-border p-4 text-center"><p className="text-lg font-semibold text-foreground">{formatPrice(candles.length ? Math.min(...candles.map((candle) => candle.low)) : 0)}</p><p className="text-xs text-muted-foreground mt-1">Lowest</p></div></div></div>
      <div className="bg-card rounded-2xl p-6 border border-border"><h3 className="font-semibold text-foreground mb-1">{signals.summary.label}</h3><p className="text-xs text-muted-foreground mb-4">Statistical signals, not financial advice.</p><div className="rounded-xl bg-muted/50 p-3 mb-4 flex justify-between gap-3"><span className="text-sm text-muted-foreground">Chance of closing higher in 7 days</span><span className="text-lg font-bold text-foreground">{formatPercent(signals.chanceUp)}</span></div><div className="space-y-3">{signals.summary.votes.map((vote) => <div key={vote.signal} className="flex gap-3"><span className={cn("w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center", vote.value > 0 ? "bg-success/10 text-success" : vote.value < 0 ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground")}>{vote.value > 0 ? "+1" : vote.value < 0 ? "-1" : "0"}</span><div><p className="text-sm font-medium text-foreground">{vote.signal}</p><p className="text-xs text-muted-foreground">{vote.reason}</p></div></div>)}</div></div>
      {fearGreed && <div className="bg-card rounded-2xl p-6 border border-border"><h3 className="font-semibold text-foreground mb-4">Fear and Greed Index</h3><div className="grid grid-cols-2 gap-3"><FearGreedGauge value={fearGreed.current.value} label="Now" /><FearGreedGauge value={fearGreed.yesterday.value} label="Yesterday" /><FearGreedGauge value={fearGreed.lastWeek.value} label="Last Week" /><FearGreedGauge value={fearGreed.lastMonth.value} label="Last Month" /></div></div>}
    </div></div>
  </div></div>;
}
