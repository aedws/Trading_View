"use client";

import { useCallback, useMemo, useState } from "react";

import { TickerAutocomplete } from "@/components/bt/TickerAutocomplete";

type Mode = "years" | "inception" | "custom";
type Rebalance = "daily" | "weekly" | "monthly" | "yearly";
type InvestMode = "lump" | "dca";
type DcaFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

const REBAL_LABEL: Record<Rebalance, string> = {
  daily: "일간 리밸런싱",
  weekly: "주간 리밸런싱",
  monthly: "월간 리밸런싱",
  yearly: "연간 리밸런싱",
};

const DCA_FREQ_LABEL: Record<DcaFrequency, string> = {
  weekly: "매주",
  biweekly: "격주",
  monthly: "매월",
  quarterly: "분기",
};

interface DividendTargetRow {
  id: string;
  ticker: string;
  weight: number;
}

interface LegRow {
  id: string;
  ticker: string;
  weight: number;
  divExpanded: boolean;
  divTargets: DividendTargetRow[]; // empty = default 100% self
}

interface CapmStats {
  alpha: number;
  beta: number;
  r2: number;
  trackingError: number;
  informationRatio: number;
  correlation: number;
  upCapture: number;
  downCapture: number;
  hitRate: number;
  n: number;
}

interface RiskAdjusted {
  sharpe: number;
  sortino: number;
  calmar: number;
  var95: number;
  cvar95: number;
}

interface DrawdownStats {
  mdd: number;
  troughDate: string;
  peakDate: string;
  recoverDate: string | null;
  current: number;
  declineDays: number;
  recoveryDays: number;
}

interface RunUpStats {
  mru: number;
  troughDate: string;
  peakDate: string;
  current: number;
  ascentDays: number;
  preTroughDays: number;
}

interface LegStats {
  ticker: string;
  weight: number;
  isDividendOnly: boolean;
  totalReturn: number;
  cagr: number;
  volAnnual: number;
  alphaVsBench: number;
  betaVsBench: number;
  corrVsBench: number;
  contribution: number;
}

interface CashSummary {
  totalContributed: number;
  portfolioFinalNominal: number;
  benchmarkFinalNominal: number;
  portfolioProfit: number;
  benchmarkProfit: number;
  portfolioXirr: number;
  benchmarkXirr: number;
}

interface YearlyRow {
  year: string;
  portfolio: number;
  benchmark: number;
  alpha: number;
}

interface MonthlyCell {
  year: number;
  month: number;
  portfolio: number;
}

interface ApiResponse {
  startDate: string;
  endDate: string;
  tradingDays: number;
  rebalance: Rebalance;
  riskFreeAnnual: number;
  benchmark: string;
  investMode: InvestMode;
  dcaFrequency: DcaFrequency | null;
  dcaAmount: number | null;
  requestedRange: { start: string; end: string };
  effectiveRange: { start: string; end: string };
  bindingLeg: { ticker: string; firstDate: string } | null;
  legInceptions: Array<{ ticker: string; firstDate: string }>;
  dividendRouting: Array<{
    ticker: string;
    targets: Array<{ ticker: string; weight: number }>;
    selfReinvest: boolean;
  }>;
  weights: Array<{ ticker: string; weight: number }>;
  currentWeights: Array<{
    ticker: string;
    weight: number;
    value: number;
    isDividendOnly: boolean;
  }>;
  portfolio: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };
  benchmarkStats: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };
  capm: CapmStats;
  risk: RiskAdjusted;
  benchRisk: RiskAdjusted;
  drawdown: { portfolio: DrawdownStats; benchmark: DrawdownStats };
  runup: { portfolio: RunUpStats; benchmark: RunUpStats };
  legs: LegStats[];
  correlation: { labels: string[]; values: number[][] };
  wealthSeries: Array<{ date: string; portfolio: number; benchmark: number }>;
  drawdownSeries: Array<{ date: string; portfolio: number; benchmark: number }>;
  yearly: YearlyRow[];
  monthlyHeatmap: { years: number[]; cells: MonthlyCell[] };
  cash: CashSummary;
}

function pct(x: number, digits = 2): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : "—";
}
function num(x: number, digits = 2): string {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}
function pp(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(2)}%p` : "—";
}

const PRESETS: Array<{ label: string; legs: Array<{ ticker: string; weight: number }> }> = [
  {
    label: "코어 60/40",
    legs: [
      { ticker: "VOO", weight: 60 },
      { ticker: "AGG", weight: 40 },
    ],
  },
  {
    label: "올웨더 풍",
    legs: [
      { ticker: "VOO", weight: 30 },
      { ticker: "TLT", weight: 40 },
      { ticker: "IEF", weight: 15 },
      { ticker: "GLD", weight: 7.5 },
      { ticker: "DBC", weight: 7.5 },
    ],
  },
  {
    label: "메가테크 풍",
    legs: [
      { ticker: "QQQ", weight: 60 },
      { ticker: "VOO", weight: 25 },
      { ticker: "SMH", weight: 15 },
    ],
  },
];

function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function mkLeg(ticker: string, weight: number): LegRow {
  return { id: newId(), ticker, weight, divExpanded: false, divTargets: [] };
}

export default function PortfolioAnalyzer() {
  const [legs, setLegs] = useState<LegRow[]>([
    mkLeg("VOO", 60),
    mkLeg("QQQ", 30),
    mkLeg("GLD", 10),
  ]);
  const [mode, setMode] = useState<Mode>("years");
  const [years, setYears] = useState(5);
  const [start, setStart] = useState("2020-01-02");
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [bench, setBench] = useState("VOO");
  const [rebalance, setRebalance] = useState<Rebalance>("daily");
  const [riskFree, setRiskFree] = useState(4.5);
  const [investMode, setInvestMode] = useState<InvestMode>("lump");
  const [lumpAmount, setLumpAmount] = useState(10000);
  const [dcaAmount, setDcaAmount] = useState(500);
  const [dcaFreq, setDcaFreq] = useState<DcaFrequency>("monthly");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const totalWeight = useMemo(
    () => legs.reduce((s, l) => s + (Number.isFinite(l.weight) ? l.weight : 0), 0),
    [legs],
  );
  const weightOk = totalWeight > 0;

  const updateLeg = useCallback(
    (id: string, patch: Partial<LegRow>) => {
      setLegs((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    },
    [],
  );
  const removeLeg = useCallback((id: string) => {
    setLegs((cur) => (cur.length <= 1 ? cur : cur.filter((l) => l.id !== id)));
  }, []);
  const addLeg = useCallback(() => {
    setLegs((cur) => (cur.length >= 10 ? cur : [...cur, mkLeg("", 0)]));
  }, []);

  const toggleDivPanel = useCallback((id: string) => {
    setLegs((cur) =>
      cur.map((l) => (l.id === id ? { ...l, divExpanded: !l.divExpanded } : l)),
    );
  }, []);
  const addDivTarget = useCallback((legId: string) => {
    setLegs((cur) =>
      cur.map((l) => {
        if (l.id !== legId) return l;
        if (l.divTargets.length >= 10) return l;
        return {
          ...l,
          divTargets: [
            ...l.divTargets,
            { id: newId(), ticker: l.ticker, weight: 100 },
          ],
        };
      }),
    );
  }, []);
  const removeDivTarget = useCallback((legId: string, targetId: string) => {
    setLegs((cur) =>
      cur.map((l) =>
        l.id === legId
          ? { ...l, divTargets: l.divTargets.filter((d) => d.id !== targetId) }
          : l,
      ),
    );
  }, []);
  const updateDivTarget = useCallback(
    (legId: string, targetId: string, patch: Partial<DividendTargetRow>) => {
      setLegs((cur) =>
        cur.map((l) =>
          l.id === legId
            ? {
                ...l,
                divTargets: l.divTargets.map((d) =>
                  d.id === targetId ? { ...d, ...patch } : d,
                ),
              }
            : l,
        ),
      );
    },
    [],
  );
  const resetDivToSelf = useCallback((legId: string) => {
    setLegs((cur) =>
      cur.map((l) => (l.id === legId ? { ...l, divTargets: [] } : l)),
    );
  }, []);
  const equalize = useCallback(() => {
    setLegs((cur) => {
      const n = cur.length || 1;
      const w = +(100 / n).toFixed(4);
      return cur.map((l) => ({ ...l, weight: w }));
    });
  }, []);
  const normalize = useCallback(() => {
    setLegs((cur) => {
      const sum = cur.reduce((s, l) => s + (Number.isFinite(l.weight) ? l.weight : 0), 0);
      if (sum <= 0) return cur;
      return cur.map((l) => ({ ...l, weight: +((l.weight / sum) * 100).toFixed(4) }));
    });
  }, []);
  const applyPreset = useCallback((p: (typeof PRESETS)[number]) => {
    setLegs(p.legs.map((l) => mkLeg(l.ticker, l.weight)));
  }, []);

  const legTickerOptions = useMemo(
    () =>
      legs
        .map((l) => l.ticker.trim().toUpperCase())
        .filter((t, i, arr) => t && arr.indexOf(t) === i),
    [legs],
  );

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const payload = {
        legs: legs
          .filter((l) => l.ticker.trim() && l.weight > 0)
          .map((l) => {
            const dist = l.divTargets
              .filter((d) => d.ticker.trim() && d.weight > 0)
              .map((d) => ({
                ticker: d.ticker.trim().toUpperCase(),
                weight: d.weight,
              }));
            return {
              ticker: l.ticker.trim().toUpperCase(),
              weight: l.weight,
              ...(dist.length > 0 ? { dividendDistribution: dist } : {}),
            };
          }),
        benchmark: bench.trim().toUpperCase() || "VOO",
        mode,
        years: mode === "years" ? years : undefined,
        start: mode === "custom" ? start : undefined,
        end: mode === "custom" ? end : undefined,
        rebalance,
        riskFreeAnnual: Number.isFinite(riskFree) ? riskFree / 100 : 0.045,
        investMode,
        ...(investMode === "lump"
          ? { lumpAmount: Number.isFinite(lumpAmount) ? lumpAmount : 1 }
          : {
              dcaAmount: Number.isFinite(dcaAmount) ? dcaAmount : 500,
              dcaFrequency: dcaFreq,
            }),
      };
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
  }, [
    legs,
    bench,
    mode,
    years,
    start,
    end,
    rebalance,
    riskFree,
    investMode,
    lumpAmount,
    dcaAmount,
    dcaFreq,
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-medium text-gray-100">포트폴리오 입력</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 mr-1">프리셋:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-[11px] px-2 py-1 rounded border border-border text-gray-300 hover:text-gray-100 hover:bg-bg-soft"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-bg-soft/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <span>종목 {legs.length}/10</span>
              <span className={weightOk ? "text-gray-400" : "text-amber-400"}>
                합계 {totalWeight.toFixed(2)}%{" "}
                {Math.abs(totalWeight - 100) > 0.01 && weightOk
                  ? "(자동 정규화됨)"
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={equalize}
                className="px-2 py-1 rounded border border-border text-gray-300 hover:text-gray-100"
              >
                균등
              </button>
              <button
                type="button"
                onClick={normalize}
                className="px-2 py-1 rounded border border-border text-gray-300 hover:text-gray-100"
              >
                100% 정규화
              </button>
              <button
                type="button"
                onClick={addLeg}
                disabled={legs.length >= 10}
                className="px-2 py-1 rounded border border-border text-gray-300 hover:text-gray-100 disabled:opacity-40"
              >
                + 종목
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {legs.map((l, i) => {
              const divSum = l.divTargets.reduce(
                (s, d) => s + (Number.isFinite(d.weight) ? d.weight : 0),
                0,
              );
              const isSelfOnly =
                l.divTargets.length === 0 ||
                (l.divTargets.length === 1 &&
                  l.divTargets[0].ticker.trim().toUpperCase() ===
                    l.ticker.trim().toUpperCase());
              return (
                <div key={l.id} className="space-y-1">
                  <div className="grid grid-cols-[1fr_120px_72px_28px] gap-2 items-center">
                    <TickerAutocomplete
                      mode="single"
                      value={l.ticker}
                      onChange={(v) =>
                        updateLeg(l.id, {
                          ticker: v.replace(/\s+/g, "").toUpperCase(),
                        })
                      }
                      placeholder={`종목 ${i + 1}`}
                      inputId={`pf-leg-${l.id}`}
                      className="w-full"
                      inputClassName="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 font-mono text-gray-100 uppercase text-sm"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={Number.isFinite(l.weight) ? l.weight : 0}
                        onChange={(e) =>
                          updateLeg(l.id, { weight: Number(e.target.value) })
                        }
                        className="w-full rounded-lg bg-bg-soft border border-border pl-2 pr-6 py-1.5 text-right text-gray-100 text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">
                        %
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDivPanel(l.id)}
                      className={`text-[11px] px-2 py-1 rounded border transition ${
                        isSelfOnly
                          ? "border-border text-gray-400 hover:text-gray-100"
                          : "border-accent-blue/60 text-accent-blue"
                      } ${l.divExpanded ? "bg-bg-soft" : ""}`}
                      title="이 종목의 배당금을 어떻게 분배할지 설정"
                    >
                      배당 {l.divExpanded ? "▴" : "▾"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLeg(l.id)}
                      disabled={legs.length <= 1}
                      aria-label="종목 제거"
                      className="text-gray-500 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-gray-500"
                    >
                      ×
                    </button>
                  </div>

                  {l.divExpanded ? (
                    <div className="ml-1 mt-1 rounded-md border border-border-soft bg-bg-soft/60 p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                        <span>
                          <span className="text-gray-300">{l.ticker || "—"}</span>{" "}
                          배당 분배 ({l.divTargets.length}/10)
                          {l.divTargets.length > 0 ? (
                            <span className="ml-2 text-gray-500">
                              합 {divSum.toFixed(2)}%{" "}
                              {Math.abs(divSum - 100) > 0.01
                                ? "(자동 정규화)"
                                : ""}
                            </span>
                          ) : (
                            <span className="ml-2 text-gray-500">
                              · 비워두면 100% 자기 재투자
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => resetDivToSelf(l.id)}
                            className="px-2 py-0.5 rounded border border-border text-gray-300 hover:text-gray-100"
                          >
                            자기 재투자로 초기화
                          </button>
                          <button
                            type="button"
                            disabled={l.divTargets.length >= 10}
                            onClick={() => addDivTarget(l.id)}
                            className="px-2 py-0.5 rounded border border-border text-gray-300 hover:text-gray-100 disabled:opacity-40"
                          >
                            + 분배
                          </button>
                        </div>
                      </div>

                      {l.divTargets.length === 0 ? (
                        <div className="text-[11px] text-gray-500 px-1 py-0.5 leading-relaxed">
                          기본: 이 종목에서 발생한 배당금은 자기 자신({l.ticker || "—"})으로
                          100% 재투자됩니다. 분배 대상으로 <b>포트폴리오에 없는
                          종목</b>도 입력 가능 — 그 종목은 <b>배당으로만 누적되는 보조 자산</b>이
                          되며 리밸런싱·신규 적립에서 제외됩니다.
                        </div>
                      ) : (
                        l.divTargets.map((d) => {
                          const targetU = d.ticker.trim().toUpperCase();
                          const isExtra =
                            !!targetU && !legTickerOptions.includes(targetU);
                          return (
                            <div
                              key={d.id}
                              className="grid grid-cols-[1fr_100px_28px] gap-2 items-center"
                            >
                              <div className="relative">
                                <TickerAutocomplete
                                  mode="single"
                                  value={d.ticker}
                                  onChange={(v) =>
                                    updateDivTarget(l.id, d.id, {
                                      ticker: v.replace(/\s+/g, "").toUpperCase(),
                                    })
                                  }
                                  placeholder="투자 외 종목도 가능"
                                  inputId={`pf-div-${d.id}`}
                                  className="w-full"
                                  inputClassName={`w-full rounded-md bg-bg-card border ${
                                    isExtra
                                      ? "border-accent-blue/60 pr-16"
                                      : "border-border-soft pr-2"
                                  } pl-2 py-1 font-mono text-xs text-gray-100 uppercase`}
                                />
                                {isExtra ? (
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-accent-blue pointer-events-none uppercase tracking-wide">
                                    배당전용
                                  </span>
                                ) : null}
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={Number.isFinite(d.weight) ? d.weight : 0}
                                  onChange={(e) =>
                                    updateDivTarget(l.id, d.id, {
                                      weight: Number(e.target.value),
                                    })
                                  }
                                  className="w-full rounded-md bg-bg-card border border-border-soft pl-2 pr-6 py-1 text-right text-gray-100 text-xs"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">
                                  %
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDivTarget(l.id, d.id)}
                                aria-label="배당 분배 제거"
                                className="text-gray-500 hover:text-amber-400"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">기간 모드</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            >
              <option value="years">최근 N년</option>
              <option value="inception">상장 이후 전체</option>
              <option value="custom">커스텀</option>
            </select>
          </label>
          {mode === "years" ? (
            <label className="space-y-1">
              <span className="text-gray-500 text-[11px]">N년</span>
              <input
                type="number"
                min={1}
                max={30}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
              />
            </label>
          ) : null}
          {mode === "custom" ? (
            <>
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
            </>
          ) : null}
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">벤치마크</span>
            <TickerAutocomplete
              mode="single"
              value={bench}
              onChange={(v) => setBench(v.replace(/\s+/g, "").toUpperCase())}
              placeholder="VOO"
              inputId="pf-bench"
              className="w-full"
              inputClassName="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 font-mono text-gray-100 uppercase"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">리밸런싱 주기</span>
            <select
              value={rebalance}
              onChange={(e) => setRebalance(e.target.value as Rebalance)}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            >
              <option value="daily">일간</option>
              <option value="weekly">주간 (ISO 주 시작)</option>
              <option value="monthly">월간 (월초 거래일)</option>
              <option value="yearly">연간 (연초 거래일)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[11px]">무위험률 (연 %)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={riskFree}
              onChange={(e) => setRiskFree(Number(e.target.value))}
              className="w-full rounded-lg bg-bg-soft border border-border px-2 py-1.5 text-gray-100"
            />
          </label>
        </div>

        <div className="rounded-lg border border-border-soft bg-bg-soft/40 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400">투자 방식:</span>
            <div
              role="tablist"
              aria-label="투자 방식 토글"
              className="flex items-center rounded-md border border-border bg-bg-card p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={investMode === "lump"}
                onClick={() => setInvestMode("lump")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition ${
                  investMode === "lump"
                    ? "bg-accent-blue text-white"
                    : "text-gray-400 hover:text-gray-100"
                }`}
              >
                거치식 (Lump-sum)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={investMode === "dca"}
                onClick={() => setInvestMode("dca")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition ${
                  investMode === "dca"
                    ? "bg-accent-blue text-white"
                    : "text-gray-400 hover:text-gray-100"
                }`}
              >
                DCA (적립식)
              </button>
            </div>
            <span className="text-[11px] text-gray-500">
              {investMode === "lump"
                ? "시작 시점에 일괄 투입. XIRR/MWR로 비교 가능."
                : "주기마다 동일 금액을 매수. 각 회차는 그날 비중대로 배분."}
            </span>
          </div>

          {investMode === "lump" ? (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-500 text-[11px]">거치 금액 (USD)</span>
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={lumpAmount}
                  onChange={(e) => setLumpAmount(Number(e.target.value))}
                  className="w-full rounded-lg bg-bg-card border border-border px-2 py-1.5 text-gray-100"
                />
              </label>
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-500 text-[11px]">회당 금액 (USD)</span>
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={dcaAmount}
                  onChange={(e) => setDcaAmount(Number(e.target.value))}
                  className="w-full rounded-lg bg-bg-card border border-border px-2 py-1.5 text-gray-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-500 text-[11px]">DCA 주기</span>
                <select
                  value={dcaFreq}
                  onChange={(e) => setDcaFreq(e.target.value as DcaFrequency)}
                  className="w-full rounded-lg bg-bg-card border border-border px-2 py-1.5 text-gray-100"
                >
                  <option value="weekly">매주 (ISO 주 시작)</option>
                  <option value="biweekly">격주</option>
                  <option value="monthly">매월 (월초 거래일)</option>
                  <option value="quarterly">분기 (분기초 거래일)</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || legs.length === 0 || !weightOk}
          className="px-3 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "계산 중…" : "포트폴리오 분석 실행"}
        </button>
        {err ? (
          <p className="text-[12px] text-amber-400">{err}</p>
        ) : null}
      </section>

      {data ? <Results data={data} /> : null}
    </div>
  );
}

function Results({ data }: { data: ApiResponse }) {
  const reqStart = data.requestedRange.start;
  const effStart = data.effectiveRange.start;
  const clampedStart = !!reqStart && reqStart < effStart;
  return (
    <>
      {data.bindingLeg && clampedStart ? (
        <div className="rounded-lg border border-accent-blue/40 bg-accent-blue/5 px-3 py-2 text-[12px] text-gray-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            기간이 신생 종목 기준으로 자동 정렬되었습니다 →{" "}
            <span className="font-mono text-accent-blue">
              {data.bindingLeg.ticker}
            </span>{" "}
            상장 이후 ({data.bindingLeg.firstDate}). 요청{" "}
            <span className="text-gray-400">
              {data.requestedRange.start} ~ {data.requestedRange.end}
            </span>{" "}
            → 실제{" "}
            <span className="text-gray-100">
              {data.effectiveRange.start} ~ {data.effectiveRange.end}
            </span>
          </span>
        </div>
      ) : null}

      {data.dividendRouting.some((r) => !r.selfReinvest) ? (
        <section className="rounded-xl border border-border bg-bg-card p-4 space-y-1.5">
          <h3 className="text-sm font-medium text-gray-200">배당 분배 적용</h3>
          <ul className="text-[12px] text-gray-300 space-y-1">
            {data.dividendRouting.map((r) => (
              <li key={r.ticker} className="flex flex-wrap items-baseline gap-1">
                <span className="font-mono text-gray-100">{r.ticker}</span>
                <span className="text-gray-500">→</span>
                {r.selfReinvest ? (
                  <span className="text-gray-400">자기 재투자 100%</span>
                ) : (
                  r.targets.map((t, i) => (
                    <span key={`${r.ticker}-${t.ticker}-${i}`} className="text-gray-300">
                      <span className="font-mono text-gray-100">{t.ticker}</span>{" "}
                      <span className="text-gray-500">
                        {(t.weight * 100).toFixed(1)}%
                      </span>
                      {i < r.targets.length - 1 ? (
                        <span className="text-gray-600">, </span>
                      ) : null}
                    </span>
                  ))
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-medium text-gray-200">개요</h3>
          <div className="text-[11px] text-gray-500">
            {data.startDate} ~ {data.endDate} · {data.tradingDays}거래일 ·
            벤치마크 <span className="text-gray-300">{data.benchmark}</span> ·{" "}
            {REBAL_LABEL[data.rebalance] ?? data.rebalance} · rf{" "}
            {(data.riskFreeAnnual * 100).toFixed(2)}% ·{" "}
            {data.investMode === "lump"
              ? "거치식"
              : `DCA ${data.dcaFrequency ? DCA_FREQ_LABEL[data.dcaFrequency] : ""} · $${data.dcaAmount ?? "—"}`}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Metric label="총수익 (TWR)" value={pct(data.portfolio.totalReturn)} />
          <Metric label="CAGR (TWR)" value={pct(data.portfolio.cagr)} />
          <Metric label="연 변동성" value={pct(data.portfolio.volAnnual)} />
          <Metric label="TWR 지수" value={`${num(data.portfolio.finalWealth, 3)}×`} />
          <Metric label="알파(연)" value={pct(data.capm.alpha)} accent="green" />
          <Metric label="베타" value={num(data.capm.beta, 2)} accent="blue" />
          <Metric label="MDD" value={pct(data.drawdown.portfolio.mdd)} accent="red" />
          <Metric label="최대 상승" value={pct(data.runup.portfolio.mru)} accent="green" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">
          {data.investMode === "dca" ? "DCA 자금흐름" : "거치식 자금흐름"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Metric label="총 납입" value={`$${num(data.cash.totalContributed, 0)}`} />
          <Metric
            label="포트 최종 평가액"
            value={`$${num(data.cash.portfolioFinalNominal, 0)}`}
          />
          <Metric
            label="포트 손익"
            value={`$${num(data.cash.portfolioProfit, 0)}`}
            accent={data.cash.portfolioProfit >= 0 ? "green" : "red"}
          />
          <Metric
            label={`${data.benchmark} 최종`}
            value={`$${num(data.cash.benchmarkFinalNominal, 0)}`}
          />
          <Metric
            label="XIRR (포트)"
            value={pct(data.cash.portfolioXirr)}
            accent="green"
          />
          <Metric
            label={`XIRR (${data.benchmark})`}
            value={pct(data.cash.benchmarkXirr)}
          />
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          XIRR(자금가중 수익률) = 모든 납입·평가액을 현금흐름으로 두고 푼 연환산
          IRR. DCA에서는 TWR(CAGR)과 차이가 날 수 있으며, 실제 사용자의 자금
          관점에서의 수익률을 더 잘 반영합니다.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">벤치마크 대비</h3>
        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-soft">
                <th className="py-2 pr-3">지표</th>
                <th className="py-2 pr-3 text-right">포트폴리오</th>
                <th className="py-2 pr-3 text-right">{data.benchmark}</th>
                <th className="py-2 text-right">차이</th>
              </tr>
            </thead>
            <tbody className="text-gray-200 font-mono">
              <Row name="총수익" a={data.portfolio.totalReturn} b={data.benchmarkStats.totalReturn} fmt="pct" />
              <Row name="CAGR" a={data.portfolio.cagr} b={data.benchmarkStats.cagr} fmt="pct" />
              <Row name="연 변동성" a={data.portfolio.volAnnual} b={data.benchmarkStats.volAnnual} fmt="pct" lowerBetter />
              <Row name="MDD" a={data.drawdown.portfolio.mdd} b={data.drawdown.benchmark.mdd} fmt="pct" lowerBetter />
              <Row name="최대 상승 (MRU)" a={data.runup.portfolio.mru} b={data.runup.benchmark.mru} fmt="pct" />
              <Row name="Sharpe" a={data.risk.sharpe} b={data.benchRisk.sharpe} fmt="num" />
              <Row name="Sortino" a={data.risk.sortino} b={data.benchRisk.sortino} fmt="num" />
              <Row name="Calmar" a={data.risk.calmar} b={data.benchRisk.calmar} fmt="num" />
              <Row name="VaR 95% (1일)" a={data.risk.var95} b={data.benchRisk.var95} fmt="pct" lowerBetter />
              <Row name="CVaR 95% (1일)" a={data.risk.cvar95} b={data.benchRisk.cvar95} fmt="pct" lowerBetter />
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">CAPM·캡처</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          <Metric label="알파(연)" value={pct(data.capm.alpha)} accent="green" />
          <Metric label="베타" value={num(data.capm.beta, 3)} />
          <Metric label="R²" value={pct(data.capm.r2)} />
          <Metric label="상관" value={num(data.capm.correlation, 3)} />
          <Metric label="추적오차(연)" value={pct(data.capm.trackingError)} />
          <Metric label="정보비율 IR" value={num(data.capm.informationRatio, 2)} />
          <Metric label="상승 캡처" value={pct(data.capm.upCapture, 1)} accent="green" />
          <Metric label="하락 캡처" value={pct(data.capm.downCapture, 1)} accent="red" />
          <Metric label="일간 승률" value={pct(data.capm.hitRate, 1)} />
          <Metric label="회귀 표본 N" value={String(data.capm.n)} />
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          알파·베타는 일간 초과수익(rₚ−r_f, r_b−r_f) CAPM 회귀. 상승 캡처 = 벤치 양봉일 평균
          rₚ / 평균 r_b. 하락 캡처는 음봉일 동일 식. 1.00 = 동일, &lt;1 = 덜 따라감.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-200">낙폭 분석</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <DdCard title="포트폴리오" dd={data.drawdown.portfolio} />
          <DdCard title={`벤치 (${data.benchmark})`} dd={data.drawdown.benchmark} />
        </div>
        <DrawdownChart series={data.drawdownSeries} benchLabel={data.benchmark} />
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-200">최대 상승 분석 (MRU)</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <RuCard title="포트폴리오" ru={data.runup.portfolio} />
          <RuCard title={`벤치 (${data.benchmark})`} ru={data.runup.benchmark} />
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          최대 상승(MRU) = 자본곡선에서의 <b>저점→고점</b> 최대 상승률. MDD의 부호를
          뒤집은 정의. 같은 구간에 큰 MRU와 큰 MDD가 함께 있으면 변동성이 크고,
          MRU/|MDD| 비율이 높을수록 회복 탄력이 강했다는 의미입니다.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">자산 곡선 (1.00 시작)</h3>
        <WealthChart series={data.wealthSeries} benchLabel={data.benchmark} />
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">자산별 상세 (α/β)</h3>
        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border-soft">
                <th className="py-2 pr-3">티커</th>
                <th className="py-2 pr-3 text-right">비중</th>
                <th className="py-2 pr-3 text-right">총수익</th>
                <th className="py-2 pr-3 text-right">CAGR</th>
                <th className="py-2 pr-3 text-right">연변동성</th>
                <th className="py-2 pr-3 text-right">α(연)</th>
                <th className="py-2 pr-3 text-right">β</th>
                <th className="py-2 pr-3 text-right">상관</th>
                <th className="py-2 text-right">기여(w×TR)</th>
              </tr>
            </thead>
            <tbody className="text-gray-200 font-mono">
              {data.legs.map((l) => (
                <tr key={l.ticker} className="border-b border-border-soft/60">
                  <td className="py-1.5 pr-3 text-gray-300">
                    {l.ticker}
                    {l.isDividendOnly ? (
                      <span className="ml-1 inline-block px-1 py-0 text-[9px] uppercase tracking-wide rounded border border-accent-blue/60 text-accent-blue font-sans">
                        배당전용
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {l.isDividendOnly ? (
                      <span className="text-gray-500">—</span>
                    ) : (
                      pct(l.weight, 1)
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{pct(l.totalReturn)}</td>
                  <td className="py-1.5 pr-3 text-right">{pct(l.cagr)}</td>
                  <td className="py-1.5 pr-3 text-right">{pct(l.volAnnual)}</td>
                  <td
                    className={`py-1.5 pr-3 text-right ${
                      Number.isFinite(l.alphaVsBench) && l.alphaVsBench >= 0
                        ? "text-accent-green"
                        : "text-amber-400"
                    }`}
                  >
                    {pct(l.alphaVsBench)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{num(l.betaVsBench, 2)}</td>
                  <td className="py-1.5 pr-3 text-right">{num(l.corrVsBench, 2)}</td>
                  <td className="py-1.5 text-right">
                    {l.isDividendOnly ? (
                      <span className="text-gray-500">—</span>
                    ) : (
                      pp(l.contribution)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-500">
          α·β는 각 자산의 일간 초과수익(자산−rf) ↔ 벤치 초과수익(벤치−rf) CAPM
          회귀. 양의 α = 베타 노출만으로 설명되지 않는 초과수익.
        </p>
      </section>

      <YearlyReturnsTable rows={data.yearly} benchLabel={data.benchmark} />

      <MonthlyHeatmap data={data.monthlyHeatmap} />

      <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-200">상관 행렬</h3>
        <CorrelationHeatmap matrix={data.correlation} />
      </section>

      <AllocationCompare
        target={data.weights}
        current={data.currentWeights}
      />
    </>
  );
}

function YearlyReturnsTable({
  rows,
  benchLabel,
}: {
  rows: YearlyRow[];
  benchLabel: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
      <h3 className="text-sm font-medium text-gray-200">연도별 수익률</h3>
      <div className="overflow-x-auto text-xs">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border-soft">
              <th className="py-2 pr-3">연도</th>
              <th className="py-2 pr-3 text-right">포트폴리오</th>
              <th className="py-2 pr-3 text-right">{benchLabel}</th>
              <th className="py-2 text-right">α (포트−벤치)</th>
            </tr>
          </thead>
          <tbody className="text-gray-200 font-mono">
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-border-soft/60">
                <td className="py-1.5 pr-3 text-gray-300">{r.year}</td>
                <td
                  className={`py-1.5 pr-3 text-right ${
                    r.portfolio >= 0 ? "text-gray-100" : "text-amber-400"
                  }`}
                >
                  {pct(r.portfolio)}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right ${
                    r.benchmark >= 0 ? "text-gray-100" : "text-amber-400"
                  }`}
                >
                  {pct(r.benchmark)}
                </td>
                <td
                  className={`py-1.5 text-right ${
                    r.alpha >= 0 ? "text-accent-green" : "text-amber-400"
                  }`}
                >
                  {pp(r.alpha)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const DONUT_PALETTE = [
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#22c55e", // green
  "#fcd34d", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#d946ef", // fuchsia
  "#eab308", // yellow
];

function colorFor(ticker: string, idx: number): string {
  // Stable per-ticker hash → palette index. Falls back to row index on
  // collision, so colors stay consistent across target↔current donuts.
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  const i = Math.abs(h ^ idx) % DONUT_PALETTE.length;
  return DONUT_PALETTE[i];
}

interface AllocSlice {
  ticker: string;
  weight: number;
  color: string;
  isDividendOnly?: boolean;
}

function AllocationCompare({
  target,
  current,
}: {
  target: Array<{ ticker: string; weight: number }>;
  current: Array<{
    ticker: string;
    weight: number;
    value: number;
    isDividendOnly: boolean;
  }>;
}) {
  // Unified ticker order = target legs first (in original order), then any
  // dividend-only / drifted legs that only show up in `current`. We assign
  // a stable color per ticker so both donuts share the same hue per asset.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const t of target) {
    if (!seen.has(t.ticker)) {
      ordered.push(t.ticker);
      seen.add(t.ticker);
    }
  }
  for (const c of current) {
    if (!seen.has(c.ticker)) {
      ordered.push(c.ticker);
      seen.add(c.ticker);
    }
  }
  const colorMap = new Map(ordered.map((t, i) => [t, colorFor(t, i)]));

  const targetMap = new Map(target.map((t) => [t.ticker, t.weight]));
  const currentMap = new Map(current.map((c) => [c.ticker, c.weight]));
  const divOnlySet = new Set(
    current.filter((c) => c.isDividendOnly).map((c) => c.ticker),
  );

  const targetSlices: AllocSlice[] = ordered
    .map((t) => ({
      ticker: t,
      weight: targetMap.get(t) ?? 0,
      color: colorMap.get(t) ?? "#9ca3af",
      isDividendOnly: divOnlySet.has(t),
    }))
    .filter((s) => s.weight > 0);
  const currentSlices: AllocSlice[] = ordered
    .map((t) => ({
      ticker: t,
      weight: currentMap.get(t) ?? 0,
      color: colorMap.get(t) ?? "#9ca3af",
      isDividendOnly: divOnlySet.has(t),
    }))
    .filter((s) => s.weight > 1e-6);

  const driftRows = ordered.map((t) => {
    const tw = targetMap.get(t) ?? 0;
    const cw = currentMap.get(t) ?? 0;
    return {
      ticker: t,
      target: tw,
      current: cw,
      drift: cw - tw,
      color: colorMap.get(t) ?? "#9ca3af",
      isDividendOnly: divOnlySet.has(t),
    };
  });

  return (
    <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-200">포트폴리오 비중 비교</h3>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        시작 시점의 <b>목표 비중</b> vs 종료 시점의 <b>현재 비중</b>. 차이는
        리밸런싱 주기 내부 드리프트 + 배당 분배(특히 배당 전용 종목 누적) 때문에
        발생합니다.
      </p>
      <div className="grid lg:grid-cols-2 gap-4">
        <DonutPanel title="시작 시점 (목표 비중)" slices={targetSlices} />
        <DonutPanel title="현재 시점 (실현 비중)" slices={currentSlices} />
      </div>
      <div className="overflow-x-auto text-xs">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border-soft">
              <th className="py-2 pr-3">티커</th>
              <th className="py-2 pr-3 text-right">목표</th>
              <th className="py-2 pr-3 text-right">현재</th>
              <th className="py-2 text-right">드리프트</th>
            </tr>
          </thead>
          <tbody className="text-gray-200 font-mono">
            {driftRows.map((r) => (
              <tr key={r.ticker} className="border-b border-border-soft/60">
                <td className="py-1.5 pr-3 text-gray-300 font-sans">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.ticker}
                  {r.isDividendOnly ? (
                    <span className="ml-1 inline-block px-1 text-[9px] uppercase tracking-wide rounded border border-accent-blue/60 text-accent-blue">
                      배당전용
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {r.target > 0 ? pct(r.target, 1) : <span className="text-gray-500">—</span>}
                </td>
                <td className="py-1.5 pr-3 text-right">{pct(r.current, 1)}</td>
                <td
                  className={`py-1.5 text-right ${
                    Math.abs(r.drift) < 1e-4
                      ? "text-gray-500"
                      : r.drift >= 0
                        ? "text-accent-green"
                        : "text-amber-400"
                  }`}
                >
                  {r.drift >= 0 ? "+" : ""}
                  {pp(r.drift)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DonutPanel({
  title,
  slices,
}: {
  title: string;
  slices: AllocSlice[];
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-bg-soft/30 p-3 space-y-3">
      <div className="text-[11px] text-gray-400">{title}</div>
      <div className="flex flex-col items-center gap-3">
        <DonutChart slices={slices} />
        <ul className="w-full space-y-1 text-xs">
          {slices.map((s) => (
            <li
              key={s.ticker}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-mono text-gray-100 truncate">
                  {s.ticker}
                </span>
                {s.isDividendOnly ? (
                  <span className="text-[9px] uppercase tracking-wide px-1 rounded border border-accent-blue/60 text-accent-blue">
                    배당전용
                  </span>
                ) : null}
              </span>
              <span className="num text-gray-100">{pct(s.weight, 1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DonutChart({ slices }: { slices: AllocSlice[] }) {
  const total = slices.reduce((s, x) => s + x.weight, 0);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 78;
  const rInner = 48;
  if (total <= 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={rOuter} fill="rgb(31 41 55 / 0.4)" />
        <circle cx={cx} cy={cy} r={rInner} fill="#0b0b0b" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
        >
          데이터 없음
        </text>
      </svg>
    );
  }

  let acc = 0;
  const arcs = slices.map((s) => {
    const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.weight;
    const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const xs1 = cx + rOuter * Math.cos(startAngle);
    const ys1 = cy + rOuter * Math.sin(startAngle);
    const xs2 = cx + rOuter * Math.cos(endAngle);
    const ys2 = cy + rOuter * Math.sin(endAngle);
    const xi1 = cx + rInner * Math.cos(endAngle);
    const yi1 = cy + rInner * Math.sin(endAngle);
    const xi2 = cx + rInner * Math.cos(startAngle);
    const yi2 = cy + rInner * Math.sin(startAngle);
    const d = [
      `M ${xs1.toFixed(2)} ${ys1.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${xs2.toFixed(2)} ${ys2.toFixed(2)}`,
      `L ${xi1.toFixed(2)} ${yi1.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${xi2.toFixed(2)} ${yi2.toFixed(2)}`,
      "Z",
    ].join(" ");
    return { d, fill: s.color, key: s.ticker };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs.map((a) => (
        <path
          key={a.key}
          d={a.d}
          fill={a.fill}
          stroke="#0b0b0b"
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}

function MonthlyHeatmap({
  data,
}: {
  data: { years: number[]; cells: MonthlyCell[] };
}) {
  if (data.years.length === 0) return null;
  const cellMap = new Map<string, number>();
  for (const c of data.cells) cellMap.set(`${c.year}-${c.month}`, c.portfolio);
  const yearCells = 13; // year label + 12 months
  const cellW = 38;
  const labelW = 56;
  const cellH = 22;
  const W = labelW + 12 * cellW;
  const H = 22 + data.years.length * cellH;
  function color(v: number): string {
    if (!Number.isFinite(v)) return "rgb(31 41 55 / 0.5)";
    const t = Math.max(-0.1, Math.min(0.1, v)) / 0.1; // saturate at ±10%
    if (t >= 0) {
      const a = 0.15 + 0.55 * t;
      return `rgba(74, 222, 128, ${a.toFixed(3)})`;
    }
    const a = 0.15 + 0.55 * -t;
    return `rgba(251, 113, 133, ${a.toFixed(3)})`;
  }
  const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  return (
    <section className="rounded-xl border border-border bg-bg-card p-4 space-y-2">
      <h3 className="text-sm font-medium text-gray-200">월별 수익 히트맵</h3>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto"
          style={{ maxWidth: `${W}px`, width: "100%" }}
        >
          {months.map((m, j) => (
            <text
              key={`m-${m}`}
              x={labelW + j * cellW + cellW / 2}
              y={14}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {m}월
            </text>
          ))}
          {data.years.map((y, i) => (
            <g key={`y-${y}`}>
              <text
                x={labelW - 4}
                y={22 + i * cellH + cellH / 2 + 3}
                fontSize={10}
                fill="#9ca3af"
                textAnchor="end"
              >
                {y}
              </text>
              {months.map((_, j) => {
                const m = j + 1;
                const v = cellMap.get(`${y}-${m}`);
                return (
                  <g key={`c-${y}-${m}`}>
                    <rect
                      x={labelW + j * cellW}
                      y={22 + i * cellH}
                      width={cellW - 1}
                      height={cellH - 1}
                      fill={color(v ?? NaN)}
                      stroke="rgb(31 41 55 / 0.8)"
                    />
                    <text
                      x={labelW + j * cellW + cellW / 2}
                      y={22 + i * cellH + cellH / 2 + 3}
                      fontSize={9}
                      fill="#e5e7eb"
                      textAnchor="middle"
                    >
                      {Number.isFinite(v ?? NaN) ? `${((v ?? 0) * 100).toFixed(1)}` : ""}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <p className="text-[10px] text-gray-500">
        값 단위 %. 셀당 해당 월의 포트폴리오 TWR. 녹색 = 플러스, 분홍 = 마이너스 (±10% 포화).
      </p>
      <p className="text-[10px] text-gray-500">
        {yearCells > 0 ? "" : ""}
      </p>
    </section>
  );
}

/* ──────────── small UI helpers ──────────── */

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "blue";
}) {
  const cls =
    accent === "green"
      ? "text-accent-green"
      : accent === "red"
        ? "text-amber-400"
        : accent === "blue"
          ? "text-accent-blue"
          : "text-gray-100";
  return (
    <div className="rounded-lg border border-border-soft px-3 py-2 bg-bg-soft/40">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-semibold num ${cls}`}>{value}</div>
    </div>
  );
}

function Row({
  name,
  a,
  b,
  fmt,
  lowerBetter,
}: {
  name: string;
  a: number;
  b: number;
  fmt: "pct" | "num";
  lowerBetter?: boolean;
}) {
  const f = fmt === "pct" ? (x: number) => pct(x) : (x: number) => num(x, 2);
  const diff = a - b;
  const betterUp = !lowerBetter ? diff > 0 : diff < 0;
  const cls =
    !Number.isFinite(diff) || Math.abs(diff) < 1e-9
      ? "text-gray-400"
      : betterUp
        ? "text-accent-green"
        : "text-amber-400";
  const diffText =
    fmt === "pct" ? pp(diff) : `${diff >= 0 ? "+" : ""}${num(diff, 2)}`;
  return (
    <tr className="border-b border-border-soft/60">
      <td className="py-1.5 pr-3 text-gray-300 font-sans">{name}</td>
      <td className="py-1.5 pr-3 text-right">{f(a)}</td>
      <td className="py-1.5 pr-3 text-right">{f(b)}</td>
      <td className={`py-1.5 text-right ${cls}`}>{diffText}</td>
    </tr>
  );
}

function DdCard({ title, dd }: { title: string; dd: DrawdownStats }) {
  return (
    <div className="rounded-lg border border-border-soft bg-bg-soft/40 p-3 space-y-1">
      <div className="text-[11px] text-gray-500">{title}</div>
      <div className="text-base font-semibold num text-amber-400">{pct(dd.mdd)}</div>
      <div className="text-[11px] text-gray-400 space-y-0.5">
        <div>피크 {dd.peakDate} → 저점 {dd.troughDate} ({dd.declineDays}일)</div>
        <div>
          회복{" "}
          {dd.recoverDate
            ? `${dd.recoverDate} (저점→회복 ${Number.isFinite(dd.recoveryDays) ? dd.recoveryDays + "일" : "—"})`
            : "미회복"}
        </div>
        <div>현재 낙폭 {pct(dd.current)}</div>
      </div>
    </div>
  );
}

function RuCard({ title, ru }: { title: string; ru: RunUpStats }) {
  return (
    <div className="rounded-lg border border-border-soft bg-bg-soft/40 p-3 space-y-1">
      <div className="text-[11px] text-gray-500">{title}</div>
      <div className="text-base font-semibold num text-accent-green">
        +{pct(ru.mru)}
      </div>
      <div className="text-[11px] text-gray-400 space-y-0.5">
        <div>
          저점 {ru.troughDate} → 고점 {ru.peakDate} ({ru.ascentDays}일)
        </div>
        <div>현재 저점 대비 상승 {pct(ru.current)}</div>
      </div>
    </div>
  );
}

/* ──────────── lightweight SVG charts ──────────── */

function WealthChart({
  series,
  benchLabel,
}: {
  series: Array<{ date: string; portfolio: number; benchmark: number }>;
  benchLabel: string;
}) {
  if (series.length < 2) return <p className="text-[11px] text-gray-500">데이터 부족</p>;
  const W = 800;
  const H = 220;
  const pad = { l: 40, r: 10, t: 10, b: 22 };
  const xs = series.map((_, i) => i);
  const ys = series.flatMap((s) => [s.portfolio, s.benchmark]);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.05 || 0.05;
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;
  const sx = (i: number) =>
    pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, xs.length - 1);
  const sy = (y: number) =>
    pad.t + (H - pad.t - pad.b) * (1 - (y - y0) / Math.max(1e-9, y1 - y0));
  const path = (key: "portfolio" | "benchmark") =>
    series.map((s, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(s[key]).toFixed(1)}`).join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const y = y0 + p * (y1 - y0);
    return { y, py: sy(y) };
  });
  const lastIdx = series.length - 1;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] h-[220px]">
        {grid.map((g) => (
          <g key={g.y}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={g.py}
              y2={g.py}
              stroke="rgb(55 65 81 / 0.5)"
              strokeWidth={1}
            />
            <text x={4} y={g.py + 3} fontSize={9} fill="#9ca3af">
              {g.y.toFixed(2)}×
            </text>
          </g>
        ))}
        <path d={path("benchmark")} fill="none" stroke="#cbd5e1" strokeWidth={1.4} strokeDasharray="4 3" />
        <path d={path("portfolio")} fill="none" stroke="#60a5fa" strokeWidth={1.8} />
        <g transform={`translate(${pad.l + 6}, ${pad.t + 10})`}>
          <line x1={0} y1={0} x2={22} y2={0} stroke="#60a5fa" strokeWidth={2.2} />
          <text x={28} y={3} fontSize={10} fill="#60a5fa">
            포트폴리오 ({series[lastIdx].portfolio.toFixed(3)}×)
          </text>
        </g>
        <g transform={`translate(${pad.l + 6}, ${pad.t + 24})`}>
          <line
            x1={0}
            y1={0}
            x2={22}
            y2={0}
            stroke="#cbd5e1"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <text x={28} y={3} fontSize={10} fill="#cbd5e1">
            {benchLabel} ({series[lastIdx].benchmark.toFixed(3)}×)
          </text>
        </g>
        <text x={pad.l} y={H - 6} fontSize={9} fill="#6b7280">
          {series[0].date}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize={9} fill="#6b7280" textAnchor="end">
          {series[lastIdx].date}
        </text>
      </svg>
    </div>
  );
}

function DrawdownChart({
  series,
  benchLabel,
}: {
  series: Array<{ date: string; portfolio: number; benchmark: number }>;
  benchLabel: string;
}) {
  if (series.length < 2) return null;
  const W = 800;
  const H = 160;
  const pad = { l: 40, r: 10, t: 10, b: 22 };
  const ys = series.flatMap((s) => [s.portfolio, s.benchmark]);
  const yMin = Math.min(...ys, -0.05);
  const y0 = yMin * 1.05;
  const y1 = 0;
  const sx = (i: number) =>
    pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, series.length - 1);
  const sy = (y: number) =>
    pad.t + (H - pad.t - pad.b) * (1 - (y - y0) / Math.max(1e-9, y1 - y0));
  const path = (key: "portfolio" | "benchmark") =>
    series.map((s, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(s[key]).toFixed(1)}`).join(" ");
  const area = series
    .map((s, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(s.portfolio).toFixed(1)}`)
    .concat([`L${sx(series.length - 1).toFixed(1)},${sy(0).toFixed(1)}`, `L${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`])
    .join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const y = y0 + p * (y1 - y0);
    return { y, py: sy(y) };
  });
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] h-[160px]">
        {grid.map((g) => (
          <g key={g.y}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={g.py}
              y2={g.py}
              stroke="rgb(55 65 81 / 0.5)"
              strokeWidth={1}
            />
            <text x={4} y={g.py + 3} fontSize={9} fill="#9ca3af">
              {(g.y * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={area} fill="rgb(251 191 36 / 0.15)" stroke="none" />
        <path d={path("benchmark")} fill="none" stroke="#cbd5e1" strokeWidth={1.4} strokeDasharray="4 3" />
        <path d={path("portfolio")} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
        <g transform={`translate(${pad.l + 6}, ${pad.t + 10})`}>
          <line x1={0} y1={0} x2={22} y2={0} stroke="#fbbf24" strokeWidth={2.2} />
          <text x={28} y={3} fontSize={10} fill="#fbbf24">
            포트폴리오 낙폭
          </text>
        </g>
        <g transform={`translate(${pad.l + 6}, ${pad.t + 24})`}>
          <line
            x1={0}
            y1={0}
            x2={22}
            y2={0}
            stroke="#cbd5e1"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <text x={28} y={3} fontSize={10} fill="#cbd5e1">
            {benchLabel} 낙폭
          </text>
        </g>
      </svg>
    </div>
  );
}

function CorrelationHeatmap({
  matrix,
}: {
  matrix: { labels: string[]; values: number[][] };
}) {
  const { labels, values } = matrix;
  if (labels.length === 0) return null;
  const cell = 38;
  const labelW = 110;
  const W = labelW + cell * labels.length;
  const H = 22 + cell * labels.length;
  function color(v: number): string {
    if (!Number.isFinite(v)) return "#374151";
    const t = Math.max(-1, Math.min(1, v));
    if (t >= 0) {
      const a = 0.15 + 0.55 * t;
      return `rgba(96, 165, 250, ${a.toFixed(3)})`;
    }
    const a = 0.15 + 0.55 * -t;
    return `rgba(251, 191, 36, ${a.toFixed(3)})`;
  }
  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto"
        style={{ maxWidth: `${W}px`, width: "100%" }}
      >
        {labels.map((lab, j) => (
          <text
            key={`top-${lab}`}
            x={labelW + j * cell + cell / 2}
            y={14}
            fontSize={10}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {lab}
          </text>
        ))}
        {values.map((row, i) => (
          <g key={`row-${labels[i]}`}>
            <text x={labelW - 4} y={22 + i * cell + cell / 2 + 3} fontSize={10} fill="#9ca3af" textAnchor="end">
              {labels[i]}
            </text>
            {row.map((v, j) => (
              <g key={`c-${i}-${j}`}>
                <rect
                  x={labelW + j * cell}
                  y={22 + i * cell}
                  width={cell - 1}
                  height={cell - 1}
                  fill={color(v)}
                  stroke="rgb(31 41 55 / 0.8)"
                />
                <text
                  x={labelW + j * cell + cell / 2}
                  y={22 + i * cell + cell / 2 + 3}
                  fontSize={9}
                  fill={i === j ? "#9ca3af" : "#e5e7eb"}
                  textAnchor="middle"
                >
                  {Number.isFinite(v) ? v.toFixed(2) : "—"}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-gray-500 mt-1">
        파랑 = 양의 상관, 주황 = 음의 상관. 일간 단순수익률 기준.
      </p>
    </div>
  );
}
