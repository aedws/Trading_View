"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import TradingViewEmbed from "@/components/TradingViewEmbed";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import MarketTickerStrip from "@/components/MarketTickerStrip";
import type { AnalysisReport } from "@/lib/analyze";
import type { RangeKey } from "@/lib/types";

/** Yahoo 심볼 정규화 — `undefined.trim` 방지, 공백 제거, 대문자화(.KS 보존). */
function normalizeTicker(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export default function HomePage() {
  const [ticker, setTicker] = useState("AAPL");
  const [range, setRange] = useState<RangeKey>("5y");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    load(ticker, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, range]);

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
        <TradingViewEmbed key={ticker} symbol={ticker} height={980} />

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
