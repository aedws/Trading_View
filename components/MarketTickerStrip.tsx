"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * "오늘의 시장 스냅샷" 카드 그리드.
 * - 카테고리(글로벌/선물/국내/변동성/외환)별 섹션으로 그룹화
 * - 각 카드: 라벨 + 카테고리 태그 + 현재가 + 등락(▲/▼ + 절대값 + %) + 미니 스파크라인
 * - 스파크라인은 변동률 방향을 따라가는 절차적(가짜) 시계열로 시각 보조용
 * - 30초마다 `/api/market` 폴링
 */

type MarketQuote = {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
};

type CategoryKey = "global" | "futures" | "domestic" | "vol" | "fx";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  tag: string;
  tagColor: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: "global", label: "글로벌 지수", tag: "GLOBAL", tagColor: "#3b82f6" },
  { key: "futures", label: "선물 시장", tag: "FUT", tagColor: "#a855f7" },
  { key: "domestic", label: "국내 지수", tag: "KR", tagColor: "#EA4335" },
  { key: "vol", label: "변동성 지표", tag: "VOL", tagColor: "#FBBC04" },
  { key: "fx", label: "외환 시장", tag: "FX", tagColor: "#06b6d4" },
];

function categorize(q: MarketQuote): CategoryKey {
  const label = q.label;
  if (label.includes("선물")) return "futures";
  if (
    label.includes("코스피") ||
    label.includes("코스닥") ||
    /\.K[SQ]$/i.test(q.symbol)
  )
    return "domestic";
  if (label.includes("VIX") || label.includes("변동성")) return "vol";
  if (label.includes("환율") || /=X$/i.test(q.symbol)) return "fx";
  return "global";
}

function fmtPrice(
  value: number | null,
  currency: string | null,
  label: string
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (label.includes("환율"))
    return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  if (currency === "KRW")
    return Math.round(value).toLocaleString("ko-KR");
  if (currency === "USD") return value.toFixed(value >= 100 ? 2 : 3);
  return value.toFixed(2);
}

function fmtChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000)
    return abs.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  if (abs >= 10) return abs.toFixed(2);
  return abs.toFixed(2);
}

/** 결정적 시드 PRNG (Mulberry32 변형) */
function makeRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  if (h === 0) h = 0x6d2b79f5;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 변동률 방향을 따라가는 절차적 시계열 (시각 보조용, 실데이터 아님) */
function generateSparkline(
  symbol: string,
  changePct: number,
  points = 24
): number[] {
  const rand = makeRng(symbol);
  const trend = (changePct ?? 0) / 100;
  const result: number[] = [];
  let prevDelta = 0;
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trendComponent = trend * 100 * Math.pow(progress, 1.15);
    const wave = Math.sin(progress * Math.PI * 3 + rand() * 6) * 1.5;
    const noise = (rand() - 0.5) * 2.6;
    const delta = trendComponent + wave + noise;
    const val = 100 + 0.85 * delta + 0.15 * prevDelta;
    prevDelta = delta;
    result.push(val);
  }
  return result;
}

function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const step = w / (values.length - 1);

  const linePts = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`
    )
    .join(" ");
  const fillPts = `0,${h} ${linePts} ${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-7 block"
      aria-hidden
    >
      <polygon points={fillPts} fill={color} opacity="0.18" />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

export default function MarketTickerStrip({
  selectedSymbol,
  onSelectSymbol,
}: {
  /** 현재 분석 중인 야후 심볼 (강조용) */
  selectedSymbol?: string | null;
  /** 카드 클릭 시 호출 → 차트·지표 분석 티커와 동기화 */
  onSelectSymbol?: (yahooSymbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
          setUpdatedAt(data.updatedAt ?? "");
        }
      } catch {
        /* keep last */
      }
    };
    load();
    timer = window.setInterval(load, 30000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, MarketQuote[]>();
    for (const q of quotes) {
      const k = categorize(q);
      const arr = map.get(k) ?? [];
      arr.push(q);
      map.set(k, arr);
    }
    return map;
  }, [quotes]);

  const interactive = typeof onSelectSymbol === "function";
  const selectedNorm = selectedSymbol ? norm(selectedSymbol) : null;

  const totalUp = quotes.filter((q) => (q.changePercent ?? 0) > 0).length;
  const totalDown = quotes.filter((q) => (q.changePercent ?? 0) < 0).length;

  return (
    <div className="rounded-xl border border-[#3c4043]/60 bg-gradient-to-br from-[#15192a] via-[#0f1320] to-[#0a0e1a] overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      {/* ============ Header ============ */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#3c4043]/40 bg-gradient-to-r from-[#1a73e8]/[0.07] via-transparent to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#1a73e8] to-[#34A853] text-white shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-100 leading-tight">
              실시간 시장 시세
            </div>
            <div className="text-[10px] text-gray-500 leading-tight">
              자료 출처 · Yahoo Finance · 30초 갱신
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] shrink-0">
          {/* Up/down summary */}
          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-[#1f1f1f]/60 border border-[#3c4043]/50">
            <span className="inline-flex items-center gap-1 text-[#81c995] tabular-nums">
              <span aria-hidden>▲</span>
              {totalUp}
            </span>
            <span className="text-gray-600">·</span>
            <span className="inline-flex items-center gap-1 text-[#f28b82] tabular-nums">
              <span aria-hidden>▼</span>
              {totalDown}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#81c995]/10 border border-[#81c995]/25 text-[#81c995]">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#81c995] animate-pulse"
              aria-hidden
            />
            <span className="font-semibold tracking-wider text-[10px]">
              LIVE
            </span>
          </div>

          <div className="hidden md:block text-[10px] text-gray-400 tabular-nums">
            업데이트{" "}
            {updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR") : "—"}
          </div>
        </div>
      </div>

      {/* ============ Body ============ */}
      <div className="p-4 space-y-5">
        {CATEGORIES.map((cat) => {
          const items = grouped.get(cat.key);
          if (!items || items.length === 0) return null;

          return (
            <section key={cat.key}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className="inline-block w-1 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: cat.tagColor }}
                  aria-hidden
                />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                  {cat.label}
                </h3>
                <span className="text-[10px] text-gray-500 tabular-nums">
                  ({items.length})
                </span>
                <div
                  className="flex-1 h-px ml-2"
                  style={{
                    background: `linear-gradient(to right, ${cat.tagColor}33, transparent)`,
                  }}
                />
              </div>

              {/* Cards grid */}
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((q) => {
                  const pct = q.changePercent ?? 0;
                  const up = pct > 0;
                  const down = pct < 0;
                  const active =
                    selectedNorm != null && norm(q.symbol) === selectedNorm;
                  const accent = up
                    ? "#81c995"
                    : down
                      ? "#f28b82"
                      : "#9aa0a6";
                  const spark = generateSparkline(q.symbol, pct);

                  return (
                    <button
                      key={q.symbol}
                      type="button"
                      disabled={!interactive}
                      onClick={() =>
                        interactive && onSelectSymbol?.(q.symbol)
                      }
                      title={
                        interactive
                          ? `${q.label} 분석 보기 (${q.symbol})`
                          : undefined
                      }
                      className={`group relative text-left rounded-lg border p-2.5 transition-all duration-200 overflow-hidden ${
                        interactive
                          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab4f8]/50"
                          : "cursor-default"
                      } ${
                        active
                          ? "border-[#8ab4f8]/70 bg-gradient-to-br from-[#1a3a52]/40 to-[#0a0e1a] ring-1 ring-[#8ab4f8]/30"
                          : "border-[#3c4043]/70 bg-gradient-to-br from-[#1a2238]/35 to-[#0a0e1a] hover:border-[#5f6368]"
                      }`}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-[#8ab4f8]"
                          aria-hidden
                        />
                      )}

                      {/* Top row: label + tag */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="text-[11px] font-medium text-gray-300 truncate">
                          {q.label}
                        </div>
                        <div
                          className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            backgroundColor: `${cat.tagColor}25`,
                            color: cat.tagColor,
                          }}
                        >
                          {cat.tag}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-[16px] font-bold tabular-nums text-gray-100 num leading-tight">
                        {fmtPrice(q.price, q.currency, q.label)}
                      </div>

                      {/* Change */}
                      <div
                        className="text-[11px] tabular-nums mt-0.5 num flex items-baseline gap-1 truncate"
                        style={{ color: accent }}
                      >
                        <span aria-hidden>
                          {up ? "▲" : down ? "▼" : "—"}
                        </span>
                        <span>{fmtChange(q.change)}</span>
                        <span className="opacity-80">
                          ({up ? "+" : ""}
                          {q.changePercent == null
                            ? "—"
                            : `${q.changePercent.toFixed(2)}%`}
                          )
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div className="mt-2 -mx-0.5 pointer-events-none">
                        <Sparkline values={spark} color={accent} />
                      </div>

                      {/* Subtle bottom glow on hover */}
                      <div
                        className="absolute inset-x-0 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: `linear-gradient(to right, transparent, ${accent}88, transparent)`,
                        }}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Skeleton (empty state) */}
        {quotes.length === 0 && (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#3c4043]/50 bg-[#1a2238]/30 p-2.5 h-[112px] animate-pulse"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
