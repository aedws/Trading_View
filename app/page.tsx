"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import TradingViewEmbed from "@/components/TradingViewEmbed";
import YahooCloseChart from "@/components/YahooCloseChart";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import MarketTickerStrip from "@/components/MarketTickerStrip";
import type { AnalysisReport } from "@/lib/analyze";
import type { RangeKey } from "@/lib/types";
import { shouldUseYahooCloseChart } from "@/lib/tvEmbedPolicy";

const TICKER_STORAGE_KEY = "market-analyzer-ticker-v1";
const CHART_H = 980;

/** Yahoo 심볼 정규화 — `undefined.trim` 방지, 공백 제거, 대문자화(.KS 보존). */
function normalizeTicker(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="rounded-xl border border-border bg-bg-card shrink-0 overflow-hidden"
      style={{ height, minHeight: height }}
    >
      <div className="h-full w-full animate-pulse bg-gradient-to-b from-bg-soft/40 to-bg-soft/10" />
    </div>
  );
}

export default function HomePage() {
  const [ticker, setTicker] = useState("AAPL");
  const [range, setRange] = useState<RangeKey>("5y");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** 첫 마운트에서만 sessionStorage 티커를 읽고, 그 전에는 /api/analyze를 호출하지 않습니다. */
  useEffect(() => {
    let next = "AAPL";
    try {
      const raw = sessionStorage.getItem(TICKER_STORAGE_KEY);
      if (raw) {
        const n = normalizeTicker(raw);
        if (n) next = n;
      }
    } catch {
      /* private mode 등 */
    }
    setTicker(next);
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    try {
      sessionStorage.setItem(TICKER_STORAGE_KEY, ticker);
    } catch {
      /* ignore */
    }
  }, [ticker, bootstrapped]);

  const load = useCallback(
    async (t: string, r: RangeKey) => {
      if (!t.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/analyze?ticker=${encodeURIComponent(t)}&range=${r}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setReport(data as AnalysisReport);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!bootstrapped) return;
    load(ticker, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, range, bootstrapped]);

  const useYahooChart = shouldUseYahooCloseChart(ticker);

  return (
    <main className="min-h-screen flex flex-col">
      <Header
        ticker={ticker}
        range={range}
        onTicker={(t) => {
          const raw = String(t ?? "").trim();
          if (!raw) return;
          setTicker(normalizeTicker(raw));
        }}
        onRange={(r) => setRange(r)}
        loading={loading}
      />

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <MarketTickerStrip />

        {!bootstrapped ? (
          <ChartSkeleton height={CHART_H} />
        ) : useYahooChart ? (
          <>
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50/95 leading-snug">
              한국 거래소 상장 종목(<span className="font-mono">.KS</span>,{" "}
              <span className="font-mono">.KQ</span>)은 TradingView 무료 임베드에서
              차트가 막히거나 알림만 뜨는 경우가 많습니다. 여기서는{" "}
              <strong className="font-medium">야후 일봉 종가</strong>로 같은 기간 추세를
              그립니다. TV 고급차트는 링크로 열어보세요.
            </div>
            {loading && !report ? (
              <ChartSkeleton height={CHART_H} />
            ) : report ? (
              <YahooCloseChart
                key={ticker}
                ticker={ticker}
                longName={report.meta.longName}
                currency={report.meta.currency}
                points={report.pricesForChart.map((p) => ({
                  date: p.date,
                  close: p.close,
                }))}
                height={CHART_H}
              />
            ) : error ? (
              <div
                className="rounded-xl border border-border bg-bg-card flex items-center justify-center text-sm text-gray-400 px-4"
                style={{ height: CHART_H, minHeight: CHART_H }}
              >
                분석 데이터를 받지 못해 차트를 그릴 수 없습니다 · {error}
              </div>
            ) : (
              <ChartSkeleton height={CHART_H} />
            )}
          </>
        ) : (
          <TradingViewEmbed key={ticker} symbol={ticker} height={CHART_H} />
        )}

        {error && (
          <div className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
            오류: {error}
          </div>
        )}

        {!report && !error && loading && (
          <div className="rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-gray-400">
            <div className="inline-block w-3 h-3 rounded-full bg-accent-blue animate-pulse mr-2" />
            지표 계산 중…
          </div>
        )}

        {report && <AnalysisDashboard report={report} />}
      </div>
    </main>
  );
}
