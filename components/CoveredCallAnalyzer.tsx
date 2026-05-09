"use client";

import { useCallback, useState } from "react";

import MarkdownBody from "@/components/MarkdownBody";
import { TickerAutocomplete } from "@/components/bt/TickerAutocomplete";

type ReinvestMode =
  | "no_reinvest"
  | "self_reinvest"
  | "distill_qqqi70_spyi30";

type ScenarioMetrics = {
  label: string;
  irr: number;
  mdd: number;
  cashOnCash: number;
  terminalWealth: number;
  contributed: number;
};

type PrincipleHit = {
  id: number;
  title: string;
  verdict: string;
  note: string;
};

type ApiResponse = {
  ticker: string;
  start: string;
  end: string;
  periodAmount: number;
  freq: string;
  primaryMode: ReinvestMode;
  longName: string | null;
  quoteNote: string;
  scenarios: Record<string, ScenarioMetrics>;
  grade: { code: string; reason: string };
  principles: PrincipleHit[];
  markdownReport: string;
  aiPrompt: string;
};

function pct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : "—";
}

export default function CoveredCallAnalyzer() {
  const [ticker, setTicker] = useState("QDTE");
  const [start, setStart] = useState("2024-03-07");
  const [end, setEnd] = useState("2026-05-04");
  const [amount, setAmount] = useState(500);
  const [freq, setFreq] = useState("W-FRI");
  const [mode, setMode] = useState<ReinvestMode>("no_reinvest");
  const [bench, setBench] = useState("VOO");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/covered-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          start,
          end,
          periodAmount: amount,
          freq,
          primaryMode: mode,
          benchmark: bench,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setData(json as ApiResponse);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ticker, start, end, amount, freq, mode, bench]);

  const primary = data?.scenarios[data.primaryMode];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-4">
        <h2 className="text-base font-medium text-gray-100">분석 입력</h2>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          야후 파이낸스 일봉·분배·분할을 사용합니다. 재투자 3종과 선택한 벤치마크는 서버에서 함께
          계산됩니다.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">티커</span>
            <TickerAutocomplete
              mode="single"
              value={ticker}
              onChange={(v) => setTicker(v.replace(/\s+/g, "").toUpperCase())}
              placeholder="예: QDTE, JEPI"
              inputId="cc-ticker"
              className="w-full"
              inputClassName="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 font-mono text-gray-100 uppercase"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">시작일</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">종료일</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">회당 금액 (USD)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">적립 빈도</span>
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            >
              <option value="W-FRI">W-FRI (금요 경향)</option>
              <option value="W-WED">W-WED</option>
              <option value="W-MON">W-MON</option>
              <option value="ME">ME (월말 거래일)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">주 시나리오 (재투자)</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ReinvestMode)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            >
              <option value="no_reinvest">미재투자</option>
              <option value="self_reinvest">자기 재투자</option>
              <option value="distill_qqqi70_spyi30">증류 70/30 (QQQI/SPYI)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">벤치마크</span>
            <TickerAutocomplete
              mode="single"
              value={bench}
              onChange={(v) => setBench(v.replace(/\s+/g, "").toUpperCase())}
              placeholder="예: VOO, SPY"
              inputId="cc-benchmark"
              className="w-full"
              inputClassName="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 font-mono text-gray-100 uppercase"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "계산 중…" : "야후 데이터로 분석"}
        </button>
        {err && (
          <div className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {err}
          </div>
        )}
      </section>

      {data && primary && (
        <>
          <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
            <h2 className="text-base font-medium text-gray-100">
              {data.longName ?? data.ticker}{" "}
              <span className="font-mono text-gray-400 text-sm">({data.ticker})</span>
            </h2>
            {data.quoteNote && (
              <p className="text-xs text-gray-500">{data.quoteNote}</p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <Metric label="IRR (XIRR)" value={pct(primary.irr)} />
              <Metric label="MDD" value={pct(primary.mdd)} />
              <Metric label="Cash-on-cash" value={pct(primary.cashOnCash)} />
              <Metric
                label="종료 자산 / 납입"
                value={`$${primary.terminalWealth.toLocaleString(undefined, { maximumFractionDigits: 0 })} / $${primary.contributed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              <span className="text-amber-100 font-medium">등급 {data.grade.code}</span>
              <span className="text-amber-100/90"> — {data.grade.reason}</span>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-200">재투자 시나리오 3종</h3>
            <div className="overflow-x-auto text-xs">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-border-soft">
                    <th className="py-2 pr-3">시나리오</th>
                    <th className="py-2 pr-3">IRR</th>
                    <th className="py-2 pr-3">MDD</th>
                    <th className="py-2">CoC</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {Object.entries(data.scenarios).map(([k, s]) => (
                    <tr key={k} className="border-b border-border-soft/60">
                      <td className="py-1.5 pr-3">{s.label}</td>
                      <td className="py-1.5 pr-3 font-mono">{pct(s.irr)}</td>
                      <td className="py-1.5 pr-3 font-mono">{pct(s.mdd)}</td>
                      <td className="py-1.5 font-mono">{pct(s.cashOnCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-200">메커니즘 원칙 체크 (발췌)</h3>
            <ul className="space-y-2 text-xs text-gray-300 leading-relaxed">
              {data.principles.map((p) => (
                <li key={p.id} className="border-l-2 border-border-soft pl-2">
                  <span className="text-gray-400">[{p.id}]</span> {p.title}{" "}
                  <span
                    className={
                      p.verdict === "warn"
                        ? "text-amber-400"
                        : p.verdict === "support"
                          ? "text-accent-green"
                          : "text-gray-500"
                    }
                  >
                    ({p.verdict})
                  </span>
                  <br />
                  {p.note}
                </li>
              ))}
            </ul>
            <details className="text-[11px] text-gray-500 mt-2">
              <summary className="cursor-pointer text-gray-400">전체 원칙 목록 (참고)</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-500 leading-relaxed">
                {PRINCIPLE_REFERENCE}
              </pre>
            </details>
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-200">마크다운 리포트</h3>
            <div className="rounded-lg border border-border-soft bg-bg-soft/50 p-3 overflow-x-auto">
              <MarkdownBody markdown={data.markdownReport} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-200">
                AI 프롬프트 (포트폴리오 템플릿)
              </h3>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(data.aiPrompt).catch(() => {})
                }
                className="text-[11px] px-2 py-1 rounded border border-border text-gray-400 hover:text-gray-100"
              >
                복사
              </button>
            </div>
            <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-bg-soft border border-border-soft text-gray-300 whitespace-pre-wrap">
              {data.aiPrompt}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft px-3 py-2 bg-bg-soft/40">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold num text-gray-100">{value}</div>
    </div>
  );
}

const PRINCIPLE_REFERENCE = `메커니즘: 1 IV·분배엔진 / 2 갭·양방향 / 3 표면유사성·변동성 / 4 분배율·IRR / 5 분산≠방어 / 7 레버·부분콜 사이클 / 13 동일메커니즘 vs 비상관 / 17 VOO 부진 / 18 레버·콜·분배 / 20 0DTE 시간
시간·복리: 6 복리 vs 단순 / 14 DCA–Lump 격차
포트폴리오: 8 증류 / 9 방어자산 페이즈 / 10 섹터분산 / 11 사이클분산 / 12 위기헷지 비중 / 15 메가트렌드 가치사슬 / 16 AI ETF 중복 / 19 단순성 / 21 강화 vs 헷지 / 22 균등 비중`;
