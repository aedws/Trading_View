"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

import EmailPane, {
  EmailAttachment,
  EmailSection,
} from "@/components/EmailPane";
import { TICKER_SELECTED_EVENT } from "@/components/InboxList";
import NewsList from "@/components/NewsList";
import TickerInput from "@/components/TickerInput";
import TradingViewEmbed from "@/components/TradingViewEmbed";
import YahooCloseChart from "@/components/YahooCloseChart";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import MarketTickerStrip from "@/components/MarketTickerStrip";
import type { AnalysisReport } from "@/lib/analyze";
import type { RangeKey } from "@/lib/types";
import { shouldUseYahooCloseChart } from "@/lib/tvEmbedPolicy";

const TICKER_STORAGE_KEY = "market-analyzer-ticker-v1";
const CHART_H = 820;

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "max", label: "MAX" },
];

const RELATED_THREADS: { href: string; label: string }[] = [
  { href: "/", label: "지표 대시보드" },
  { href: "/backtest", label: "DCA 백테스트" },
  { href: "/covered-call", label: "커버드콜 분석" },
  { href: "/portfolio", label: "포트폴리오 분석" },
];

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
  const [sentAt, setSentAt] = useState("오전 8:30");

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

    const now = new Date();
    const hh = now.getHours();
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ampm = hh < 12 ? "오전" : "오후";
    const h12 = hh % 12 || 12;
    setSentAt(`${ampm} ${h12}:${mm} (방금)`);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    try {
      sessionStorage.setItem(TICKER_STORAGE_KEY, ticker);
    } catch {
      /* ignore */
    }
  }, [ticker, bootstrapped]);

  /** 받은편지함(InboxList)이나 다른 컴포넌트에서 티커를 바꿨을 때 동기화 */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" && detail) {
        setTicker((prev) => (prev === detail ? prev : detail));
      }
    };
    window.addEventListener(TICKER_SELECTED_EVENT, handler);
    return () => window.removeEventListener(TICKER_SELECTED_EVENT, handler);
  }, []);

  /** 사용자가 직접 티커를 바꾼 경우 — 다른 컴포넌트에도 알림 */
  const changeTicker = useCallback((next: string) => {
    const normalized = normalizeTicker(String(next ?? "").trim());
    if (!normalized) return;
    setTicker((prev) => {
      if (prev === normalized) return prev;
      try {
        sessionStorage.setItem(TICKER_STORAGE_KEY, normalized);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent(TICKER_SELECTED_EVENT, { detail: normalized })
      );
      return normalized;
    });
  }, []);

  const load = useCallback(async (t: string, r: RangeKey) => {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const intra = shouldUseYahooCloseChart(t) ? "&intraday15m=1" : "";
      const res = await fetch(
        `/api/analyze?ticker=${encodeURIComponent(t)}&range=${encodeURIComponent(r)}${intra}`,
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
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    load(ticker, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, range, bootstrapped]);

  const useYahooChart = shouldUseYahooCloseChart(ticker);

  const subject = `[Daily Brief] ${ticker || "AAPL"} · 기술적 분석 리포트`;
  const longName = report?.meta.longName ?? "";

  return (
    <EmailPane
      subject={subject}
      senderName="Equity Research"
      senderEmail="research@market-brief.com"
      senderInitial="ER"
      senderColor="from-[#1a73e8] to-[#ea4335]"
      date={sentAt}
      labels={[
        { label: "받은편지함" },
        { label: "Markets", color: "#34A853" },
        { label: "Daily Brief", color: "#FBBC04" },
        { label: "중요", color: "#EA4335" },
      ]}
      total={1247}
      index={1}
      metaNote={
        <span className="inline-flex items-center gap-1">
          <span>첨부 1개:</span>
          <span className="text-[#8ab4f8] underline-offset-2 hover:underline">
            {ticker}-technical-analysis.pdf
          </span>
          <span className="text-gray-500">· 2.4 MB</span>
        </span>
      }
      signature={
        <div className="space-y-1">
          <p>감사합니다.</p>
          <p>
            <strong className="text-gray-200">Equity Research Team</strong>
            <br />
            Market Brief Daily — Global Equities Desk
            <br />
            <span className="text-[#8ab4f8]">research@market-brief.com</span> ·
            +82-2-XXXX-XXXX
          </p>
          <p className="text-[11px] text-gray-500 pt-2 max-w-2xl">
            ※ 본 메일은 발신 전용입니다. 본 자료는 교육·참고용이며 어떠한
            투자 권유도 아닙니다. 자료 출처: Yahoo Finance, TradingView.
            가격 지연·세금·수수료는 반영하지 않았습니다.
          </p>
        </div>
      }
    >
      {/* 인사 + 인트로 */}
      <p>안녕하세요, 고객님.</p>
      <p className="mt-2">
        오늘의 시장 동향과 함께{" "}
        <strong className="text-gray-100">
          {ticker}
          {longName ? ` (${longName})` : ""}
        </strong>
        에 대한 기술적 분석 리포트를 전달드립니다. 본 리포트는{" "}
        <strong className="text-gray-100">{range.toUpperCase()}</strong>{" "}
        기간 데이터를 기준으로 산출되었으며, 각 지표의 수식·의미·신호·주의사항은
        본문 하단의 카드별 해설을 참고해 주시기 바랍니다.
      </p>

      {/* 보기 옵션 (티커, 기간, 페이지 네비 — 위장된 인라인 컨트롤) */}
      <div className="mt-5 rounded-lg border border-[#3c4043] bg-[#1f1f1f] p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] text-gray-300">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-[#8ab4f8]"
              fill="currentColor"
            >
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </svg>
            <span className="font-medium">이 메일의 보기 옵션</span>
          </div>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#fdd663]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#fdd663] animate-pulse" />
              실시간 데이터 동기화 중
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 min-w-[260px] flex-1">
            <span className="text-[12px] text-gray-400 shrink-0">종목:</span>
            <TickerInput initial={ticker} onSubmit={changeTicker} />
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-400">기간:</span>
            <div className="flex bg-[#2d2e30] border border-[#3c4043] rounded-lg p-0.5 text-xs">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    range === r.key
                      ? "bg-[#8ab4f8] text-[#001d35]"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3c4043]/60">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider">
            관련 리포트
          </span>
          {RELATED_THREADS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-[12px] px-2.5 py-1 rounded-full bg-[#2d2e30] border border-[#3c4043] text-gray-300 hover:bg-[#3c4043] hover:text-white transition"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 섹션 1: 시장 스냅샷 */}
      <EmailSection number={1} title="오늘의 시장 스냅샷">
        주요 지수·선물·환율·국내 거래소 대표 종목의 최근 시세입니다. 카드를
        클릭하면 본 리포트의 분석 대상이 해당 심볼로 전환됩니다.
      </EmailSection>
      <MarketTickerStrip
        selectedSymbol={ticker}
        onSelectSymbol={changeTicker}
      />

      {/* 관련 시장 뉴스 */}
      <div className="mt-5 text-[13px] text-gray-300">
        관련해서 시장에서 주목받는 뉴스도 함께 정리했습니다.
      </div>
      <NewsList seed={ticker} max={10} className="mt-2" />

      {/* 섹션 2: 차트 */}
      <EmailSection number={2} title={`${ticker} 가격 차트`}>
        TradingView 임베드 차트(또는 야후 종가)를 기반으로 합니다. 차트 좌측
        도구를 이용해 추세선·지표를 추가하실 수 있습니다.
      </EmailSection>

      {!bootstrapped ? (
        <ChartSkeleton height={CHART_H} />
      ) : useYahooChart ? (
        <>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50/95 leading-snug mb-3">
            ※ 일부 지수·선물(<span className="font-mono">^GSPC</span>,{" "}
            <span className="font-mono">^IXIC</span> 등)과 한국 거래소(
            <span className="font-mono">.KS</span>,{" "}
            <span className="font-mono">.KQ</span>), 원/달러 외 FX(
            <span className="font-mono">⋯=X</span>)는 TradingView 무료 임베드
            제한으로 차트가 막힐 수 있어{" "}
            <strong>야후 15분 봉(최근 약 59일 한도 · 지연 가능)</strong>을 우선
            표시하고, 없으면 일봉 종가로 대체합니다.
          </div>
          {loading && !report ? (
            <ChartSkeleton height={CHART_H} />
          ) : report ? (
            <EmailAttachment
              filename={`${ticker}-chart.png`}
              size={report.yahooIntradayChart ? "15m bars" : "1d close"}
            >
              <YahooCloseChart
                key={ticker}
                ticker={ticker}
                longName={report.meta.longName}
                currency={report.meta.currency}
                granularity={report.yahooIntradayChart ? "15m" : "1d"}
                points={
                  report.yahooIntradayChart?.points ??
                  report.pricesForChart.map((p) => ({
                    date: p.date,
                    close: p.close,
                  }))
                }
                height={CHART_H}
              />
            </EmailAttachment>
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
        <EmailAttachment filename={`${ticker}-chart.html`} size="TradingView">
          <TradingViewEmbed key={ticker} symbol={ticker} height={CHART_H} />
        </EmailAttachment>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          오류: {error}
        </div>
      )}

      {!report && !error && loading && (
        <div className="mt-4 rounded-xl border border-border bg-bg-card p-12 text-center text-sm text-gray-400">
          <div className="inline-block w-3 h-3 rounded-full bg-accent-blue animate-pulse mr-2" />
          지표 계산 중…
        </div>
      )}

      {/* 섹션 3: 기술적 지표 */}
      {report && (
        <>
          <EmailSection number={3} title="기술적 지표 분석">
            통계·장세·리스크·주기 지표를 카드 형태로 정리했습니다. 각 카드는
            수식·의미·신호·주의사항을 함께 표시합니다.
          </EmailSection>
          <AnalysisDashboard report={report} />
        </>
      )}
    </EmailPane>
  );
}
