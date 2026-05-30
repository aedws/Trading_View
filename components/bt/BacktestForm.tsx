"use client";

import { useState } from "react";

import type { DcaResult, Frequency } from "@/lib/bt/backtest";
import type { BacktestApiResponse, PerTickerOutcome } from "@/lib/bt/backtestApi";
import type { FetchMode } from "@/lib/bt/yahoo";
import { classNames } from "@/lib/bt/format";

import { CompareChart } from "./CompareChart";
import { CompareTable } from "./CompareTable";
import { ResultPanel } from "./ResultPanel";
import { TickerAutocomplete } from "./TickerAutocomplete";

type PeriodChoice = "10y" | "ny" | "inception" | "custom";
type UnitMode = "amount" | "shares";

const FREQ_LABEL: Record<Frequency, string> = {
  daily: "매일",
  weekly: "매주",
  biweekly: "2주마다",
  monthly: "매월",
  yearly: "매년",
};

const today = () => new Date().toISOString().slice(0, 10);
const tenYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
};

export function BacktestForm() {
  const [tickersRaw, setTickersRaw] = useState("AAPL");
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>("10y");
  const [years, setYears] = useState(10);
  const [start, setStart] = useState(tenYearsAgo());
  const [end, setEnd] = useState(today());
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [unitMode, setUnitMode] = useState<UnitMode>("amount");
  const [amount, setAmount] = useState(500);
  const [shares, setShares] = useState(1);
  const [fractional, setFractional] = useState(true);
  const [fractionalShares, setFractionalShares] = useState(false);
  // PR-C: alt-ticker scenarios (off by default).
  const [altReinvestEnabled, setAltReinvestEnabled] = useState(false);
  const [altReinvestTicker, setAltReinvestTicker] = useState("VOO");
  const [altPrincipalEnabled, setAltPrincipalEnabled] = useState(false);
  const [altPrincipalTicker, setAltPrincipalTicker] = useState("VOO");

  const [loading, setLoading] = useState(false);
  const [outcomes, setOutcomes] = useState<PerTickerOutcome[] | null>(null);
  const [benchmark, setBenchmark] = useState<PerTickerOutcome | null>(null);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Per-ticker user override of auto-detected covered-call flag.
   *  undefined = "use auto", true/false = forced. */
  const [coveredCallOverrides, setCoveredCallOverrides] = useState<
    Record<string, boolean>
  >({});
  /** Tickers currently being re-fetched after a user toggled the override. */
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());

  function buildPayload(overrides?: Record<string, boolean>) {
    const tickers = tickersRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    let mode: FetchMode = "years";
    if (periodChoice === "10y") mode = "years";
    else if (periodChoice === "ny") mode = "years";
    else if (periodChoice === "inception") mode = "inception";
    else mode = "custom";

    const altRSym = altReinvestEnabled ? altReinvestTicker.trim().toUpperCase() : "";
    const altPSym = altPrincipalEnabled ? altPrincipalTicker.trim().toUpperCase() : "";

    return {
      tickers,
      mode,
      years: periodChoice === "10y" ? 10 : periodChoice === "ny" ? years : undefined,
      start: mode === "custom" ? start : undefined,
      end: mode === "custom" ? end : undefined,
      frequency,
      unitMode,
      amount: unitMode === "amount" ? amount : undefined,
      shares: unitMode === "shares" ? shares : undefined,
      fractional,
      fractionalShares,
      coveredCallOverrides: overrides ?? coveredCallOverrides,
      altReinvestTicker: altRSym || undefined,
      altPrincipalTicker: altPSym || undefined,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setOutcomes(null);
    setBenchmark(null);
    setBenchmarkSymbol(null);
    setCoveredCallOverrides({});

    const payload = buildPayload({});
    if (payload.tickers.length === 0) {
      setSubmitError("티커를 한 개 이상 입력해주세요.");
      return;
    }
    if (payload.tickers.length > 10) {
      setSubmitError("티커는 최대 10개까지 입력할 수 있어요.");
      return;
    }
    if (payload.unitMode === "amount") {
      if (!Number.isFinite(payload.amount) || (payload.amount as number) <= 0) {
        setSubmitError("매수 금액은 0보다 큰 숫자여야 합니다.");
        return;
      }
    } else {
      if (!Number.isFinite(payload.shares) || (payload.shares as number) <= 0) {
        setSubmitError("매수 주식 수는 0보다 큰 숫자여야 합니다.");
        return;
      }
    }
    if (payload.mode === "custom" && payload.start && payload.end && payload.start >= payload.end) {
      setSubmitError("시작일이 종료일보다 빨라야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Partial<BacktestApiResponse> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setOutcomes((data.results ?? []) as PerTickerOutcome[]);
      setBenchmark(data.benchmark ?? null);
      setBenchmarkSymbol(data.benchmarkSymbol ?? null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const successOutcomes = (outcomes ?? []).filter(
    (o): o is PerTickerOutcome & { result: DcaResult } => o.ok && !!o.result,
  );
  const successResults = successOutcomes.map((o) => o.result);

  const failed = (outcomes ?? []).filter((o) => !o.ok);
  const benchmarkResult: DcaResult | null =
    benchmark && benchmark.ok && benchmark.result ? benchmark.result : null;
  const benchmarkErr =
    benchmark && !benchmark.ok ? benchmark.error ?? null : null;

  async function refetchTicker(ticker: string, applied: boolean) {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;

    const nextOverrides = { ...coveredCallOverrides, [sym]: applied };
    setCoveredCallOverrides(nextOverrides);
    setRefreshing((prev) => new Set(prev).add(sym));

    const fullPayload = buildPayload(nextOverrides);
    // Only re-run for this single ticker; benchmark is unchanged.
    const singlePayload = { ...fullPayload, tickers: [sym], benchmark: "" };
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singlePayload),
      });
      const data = (await res.json()) as Partial<BacktestApiResponse> & {
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      const updated = data.results?.[0];
      if (!updated) return;
      setOutcomes((prev) =>
        (prev ?? []).map((o) => (o.ticker === sym ? updated : o)),
      );
    } catch (err) {
      // Revert override on failure so the UI stays consistent with server state.
      setCoveredCallOverrides((prev) => {
        const c = { ...prev };
        delete c[sym];
        return c;
      });
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing((prev) => {
        const c = new Set(prev);
        c.delete(sym);
        return c;
      });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <form
          onSubmit={onSubmit}
          className="overflow-hidden rounded-xl border border-[#3c4043]/70 bg-gradient-to-br from-[#15192a] via-[#11142a] to-[#0a0e1a] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-12px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3c4043]/50 bg-gradient-to-r from-[#a855f7]/[0.07] via-transparent to-transparent">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#a855f7] to-[#3b82f6] text-white shadow-sm shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-semibold tracking-tight text-gray-100 leading-tight">
                백테스트 설정
              </h2>
              <p className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                Quant Strategy · DCA 시뮬레이터
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#a855f7]/10 border border-[#a855f7]/30 text-[9.5px] font-semibold uppercase tracking-wider text-[#c084fc]">
              <span className="inline-block w-1 h-1 rounded-full bg-[#c084fc] animate-pulse" />
              READY
            </span>
          </div>

          <div className="p-5">

          <Field
            label="티커 (쉼표로 구분, 최대 10개)"
            hint="미국 종목은 그대로(예: AAPL, VOO, QQQ). 한국은 .KS(코스피) / .KQ(코스닥) 접미사 — 예: 005930.KS(삼성전자), 069500.KS(KODEX 200)."
          >
            <TickerAutocomplete
              mode="multi"
              value={tickersRaw}
              onChange={setTickersRaw}
              placeholder="AAPL, MSFT, SPY  또는  005930.KS, 069500.KS"
              inputClassName={`${inputCls} font-mono uppercase`}
              inputId="bt-tickers"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { label: "AAPL", v: "AAPL" },
                { label: "VOO", v: "VOO" },
                { label: "QQQ", v: "QQQ" },
                { label: "삼성전자", v: "005930.KS" },
                { label: "KODEX 200", v: "069500.KS" },
                { label: "TIGER 美나스닥100", v: "133690.KS" },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => {
                    const list = tickersRaw
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    if (list.includes(p.v.toUpperCase())) {
                      setTickersRaw(
                        list
                          .filter((t) => t.toUpperCase() !== p.v.toUpperCase())
                          .join(", "),
                      );
                    } else {
                      setTickersRaw([...list, p.v].join(", "));
                    }
                  }}
                  className={classNames(
                    "rounded-md border px-2 py-1 text-[11px] font-medium transition",
                    tickersRaw
                      .split(",")
                      .map((t) => t.trim().toUpperCase())
                      .includes(p.v.toUpperCase())
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-bg-subtle text-ink-muted hover:border-border-strong hover:text-ink",
                  )}
                  title={p.v}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="기간">
            <div className="grid grid-cols-2 gap-2">
              <Choice
                active={periodChoice === "10y"}
                onClick={() => setPeriodChoice("10y")}
              >
                최근 10년
              </Choice>
              <Choice
                active={periodChoice === "ny"}
                onClick={() => setPeriodChoice("ny")}
              >
                최근 N년
              </Choice>
              <Choice
                active={periodChoice === "inception"}
                onClick={() => setPeriodChoice("inception")}
              >
                상장일부터
              </Choice>
              <Choice
                active={periodChoice === "custom"}
                onClick={() => setPeriodChoice("custom")}
              >
                커스텀
              </Choice>
            </div>
            {periodChoice === "ny" ? (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="num w-10 text-right text-sm">{years}y</span>
              </div>
            ) : null}
            {periodChoice === "custom" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
            ) : null}
          </Field>

          <Field label="매수 주기">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                <Choice
                  key={f}
                  active={frequency === f}
                  onClick={() => setFrequency(f)}
                >
                  {FREQ_LABEL[f]}
                </Choice>
              ))}
            </div>
          </Field>

          <Field
            label="매수 단위"
            hint={
              unitMode === "amount"
                ? "회차마다 정한 금액으로 매수합니다. 금액 단위는 각 티커의 현지 통화(미국: 달러, 한국: 원)입니다."
                : "회차마다 정한 주식 수만큼 매수합니다 (가격 변동에 따라 투자금이 달라집니다)."
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Choice
                active={unitMode === "amount"}
                onClick={() => setUnitMode("amount")}
              >
                금액 ($)
              </Choice>
              <Choice
                active={unitMode === "shares"}
                onClick={() => setUnitMode("shares")}
              >
                주식 수
              </Choice>
            </div>
          </Field>

          {unitMode === "amount" ? (
            <Field
              label="매수 금액 (티커당 · 현지 통화)"
              hint="여러 티커 입력 시, 매 주기마다 각 티커에 동일하게 이 금액을 매수합니다."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  $
                </span>
                <input
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={Number.isFinite(amount) ? amount : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setAmount(NaN);
                      return;
                    }
                    const n = Number(v);
                    setAmount(Number.isFinite(n) ? n : NaN);
                  }}
                  className={classNames(inputCls, "pl-6")}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[100, 250, 500, 1000, 2000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={classNames(
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition",
                      amount === v
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-bg-subtle text-ink-muted hover:border-border-strong hover:text-ink",
                    )}
                  >
                    ${v.toLocaleString()}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Field
              label="매수 주식 수 (주, 티커당)"
              hint="매 주기마다 각 티커에 정확히 이 주식 수만큼 매수합니다 (실제 투자금은 가격에 따라 달라집니다)."
            >
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  step={fractionalShares ? "any" : 1}
                  inputMode={fractionalShares ? "decimal" : "numeric"}
                  value={Number.isFinite(shares) ? shares : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setShares(NaN);
                      return;
                    }
                    const n = Number(v);
                    setShares(Number.isFinite(n) ? n : NaN);
                  }}
                  className={classNames(inputCls, "pr-10")}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                  주
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 2, 5, 10].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setShares(v)}
                    className={classNames(
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition",
                      shares === v
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-bg-subtle text-ink-muted hover:border-border-strong hover:text-ink",
                    )}
                  >
                    {v}주
                  </button>
                ))}
              </div>
            </Field>
          )}

          {unitMode === "amount" ? (
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={fractional}
                onChange={(e) => setFractional(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-bg-subtle accent-accent"
              />
              분수 매수 허용 (해제 시 정수 주식만, 잔액 이월)
            </label>
          ) : (
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={fractionalShares}
                onChange={(e) => setFractionalShares(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-bg-subtle accent-accent"
              />
              소수점 주식 허용 (예: 0.5주)
            </label>
          )}

          <AltScenarios
            altReinvestEnabled={altReinvestEnabled}
            altReinvestTicker={altReinvestTicker}
            onToggleAltReinvest={setAltReinvestEnabled}
            onChangeAltReinvest={setAltReinvestTicker}
            altPrincipalEnabled={altPrincipalEnabled}
            altPrincipalTicker={altPrincipalTicker}
            onToggleAltPrincipal={setAltPrincipalEnabled}
            onChangeAltPrincipal={setAltPrincipalTicker}
          />

          <MultiTickerHint
            tickerCount={tickersRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean).length}
            unitMode={unitMode}
            amount={amount}
            shares={shares}
            frequency={frequency}
          />

          <button
            type="submit"
            disabled={loading}
            className="group/btn relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#a855f7] to-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(168,85,247,0.45)] transition hover:shadow-[0_6px_20px_-6px_rgba(168,85,247,0.6)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {loading ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                <span>실행 중…</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>백테스트 실행</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
              </>
            )}
          </button>

          {submitError ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 mt-0.5" fill="currentColor">
                <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z" />
              </svg>
              <span>{submitError}</span>
            </div>
          ) : null}
          </div>
        </form>

        <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-dim">
          데이터: Yahoo Finance (배당·분할 조정). 세금/수수료 미반영.
          IRR은 이분법으로 계산하며 수렴하지 않으면 “—”로 표시됩니다.
        </p>
      </aside>

      <section className="min-w-0 space-y-6">
        {!outcomes && !loading ? (
          <Empty />
        ) : null}
        {loading ? <LoadingPlaceholder /> : null}

        {failed.length > 0 ? (
          <div className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm">
            <div className="font-semibold text-accent-red">일부 티커 실행 실패</div>
            <ul className="mt-1 list-disc pl-5 text-xs text-accent-red/90">
              {failed.map((f) => (
                <li key={f.ticker}>
                  <span className="font-mono">{f.ticker}</span>: {f.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {successResults.length > 1 ? (
          <div className="rounded-xl border border-border bg-bg-panel p-5">
            <div className="mb-3 text-sm font-semibold tracking-wide text-ink-muted">
              티커 비교 — 평가액 / 누적 투자금 (1.0 = 본전)
            </div>
            <CompareChart results={successResults} />
            <div className="mt-4">
              <CompareTable results={successResults} />
            </div>
          </div>
        ) : null}

        {benchmarkErr && successResults.length > 0 ? (
          <div className="rounded-md border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-xs text-accent-amber">
            벤치마크({benchmarkSymbol ?? "VOO"}) 데이터를 불러오지 못했습니다: {benchmarkErr}
          </div>
        ) : null}

        {successOutcomes.map((o) => (
          <ResultPanel
            key={o.ticker}
            outcome={o}
            benchmark={
              // Don't compare a ticker against itself.
              benchmarkResult && benchmarkResult.ticker !== o.ticker
                ? benchmarkResult
                : null
            }
            benchmarkSymbol={benchmarkSymbol}
            refreshing={refreshing.has(o.ticker)}
            onToggleCoveredCall={(applied) => refetchTicker(o.ticker, applied)}
          />
        ))}
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-dim outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        <span
          className="inline-block w-1 h-1 rounded-full bg-gradient-to-br from-[#a855f7] to-[#3b82f6]"
          aria-hidden
        />
        {label}
      </div>
      {children}
      {hint ? (
        <div className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function MultiTickerHint({
  tickerCount,
  unitMode,
  amount,
  shares,
  frequency,
}: {
  tickerCount: number;
  unitMode: UnitMode;
  amount: number;
  shares: number;
  frequency: Frequency;
}) {
  if (tickerCount < 2) return null;
  const perPeriod = `매 ${FREQ_LABEL[frequency]}`;
  if (unitMode === "amount") {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const total = amount * tickerCount;
    return (
      <div className="mt-3 rounded-md border border-border bg-bg-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
        <span className="text-ink">{tickerCount}개 티커</span> × $
        {amount.toLocaleString()} ={" "}
        <span className="text-accent">${total.toLocaleString()}</span>
        <span className="text-ink-dim"> / {perPeriod}</span>
      </div>
    );
  }
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const totalShares = shares * tickerCount;
  return (
    <div className="mt-3 rounded-md border border-border bg-bg-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
      <span className="text-ink">{tickerCount}개 티커</span> × {shares}주 ={" "}
      <span className="text-accent">{totalShares}주</span>
      <span className="text-ink-dim"> / {perPeriod} (실제 투자금은 가격에 따라 달라짐)</span>
    </div>
  );
}

/**
 * PR-C: collapsible "alternative scenarios" panel — adds two extra lines to
 * the dividend-reinvest comparison chart. Both off by default to keep the
 * default UI clean for users who don't need this view.
 */
function AltScenarios({
  altReinvestEnabled,
  altReinvestTicker,
  onToggleAltReinvest,
  onChangeAltReinvest,
  altPrincipalEnabled,
  altPrincipalTicker,
  onToggleAltPrincipal,
  onChangeAltPrincipal,
}: {
  altReinvestEnabled: boolean;
  altReinvestTicker: string;
  onToggleAltReinvest: (v: boolean) => void;
  onChangeAltReinvest: (v: string) => void;
  altPrincipalEnabled: boolean;
  altPrincipalTicker: string;
  onToggleAltPrincipal: (v: boolean) => void;
  onChangeAltPrincipal: (v: string) => void;
}) {
  const anyOn = altReinvestEnabled || altPrincipalEnabled;
  const [open, setOpen] = useState(anyOn);
  return (
    <div className="mb-4 rounded-md border border-border bg-bg-subtle/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-ink-muted hover:text-ink"
      >
        <span>
          대체 시나리오{" "}
          {anyOn ? (
            <span className="ml-1 normal-case text-accent">활성</span>
          ) : (
            <span className="ml-1 normal-case text-ink-dim">선택 사항</span>
          )}
        </span>
        <span className="text-ink-dim">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-[10px] leading-relaxed text-ink-dim">
            아래 옵션은 분배금 재투자 비교 차트에 라인을 추가합니다. 커버드콜
            ETF (예: JEPI/JEPQ/QYLD) 처럼 분배금이 큰 종목에서 가장 의미가
            있습니다.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={altReinvestEnabled}
              onChange={(e) => onToggleAltReinvest(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-bg-subtle accent-accent"
            />
            분배금을 다른 종목에 재투자
          </label>
          {altReinvestEnabled ? (
            <input
              type="text"
              value={altReinvestTicker}
              onChange={(e) => onChangeAltReinvest(e.target.value)}
              placeholder="예: VOO, QQQ, SCHD"
              className={classNames(inputCls, "font-mono uppercase")}
              autoComplete="off"
              spellCheck={false}
            />
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={altPrincipalEnabled}
              onChange={(e) => onToggleAltPrincipal(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-bg-subtle accent-accent"
            />
            원금을 다른 종목에 동일 DCA
          </label>
          {altPrincipalEnabled ? (
            <input
              type="text"
              value={altPrincipalTicker}
              onChange={(e) => onChangeAltPrincipal(e.target.value)}
              placeholder="예: VOO, QQQ, SCHD"
              className={classNames(inputCls, "font-mono uppercase")}
              autoComplete="off"
              spellCheck={false}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "relative rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 overflow-hidden",
        active
          ? "border-[#8ab4f8]/70 bg-gradient-to-br from-[#1a3a52]/60 to-[#1a73e8]/15 text-[#8ab4f8] shadow-[0_0_0_1px_rgba(138,180,248,0.15)_inset]"
          : "border-[#3c4043] bg-[#1a2238]/40 text-gray-300 hover:border-[#5f6368] hover:bg-[#1a2238]/70 hover:text-white",
      )}
    >
      {active && (
        <span
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#8ab4f8]/60 to-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

function Empty() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#3c4043]/60 bg-gradient-to-br from-[#15192a] via-[#11142a] to-[#0a0e1a] px-6 py-14 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,0.12),transparent_60%)]"
      />
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a855f7]/30 to-[#3b82f6]/30 border border-[#a855f7]/30 shadow-[0_0_24px_-4px_rgba(168,85,247,0.5)]">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#c084fc]" fill="currentColor">
            <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
          </svg>
        </div>
        <div className="text-[15px] font-semibold tracking-tight text-gray-100">
          시작할 준비 완료
        </div>
        <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-gray-400">
          좌측에 티커, 기간, 매수 주기, 금액을 입력하고{" "}
          <span className="mx-0.5 inline-flex items-center gap-1 rounded bg-[#a855f7]/15 px-1.5 py-0.5 font-semibold text-[#c084fc] border border-[#a855f7]/30">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            백테스트 실행
          </span>
          을 누르세요. 여러 티커를 쉼표로 입력하면 비교 차트가 함께 나옵니다.
        </p>
        <div className="mt-2 flex items-center gap-3 text-[10.5px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-[#81c995]" />
            야후 일봉(분배·분할) 기반
          </span>
          <span className="text-gray-700">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-[#fdd663]" />
            IRR·MDD·벤치마크 비교
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="relative h-32 overflow-hidden rounded-xl border border-[#3c4043]/60 bg-gradient-to-br from-[#15192a] to-[#0a0e1a]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-[#a855f7]/[0.06] to-transparent" />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 animate-spin text-[#a855f7]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          <span className="text-[12px] text-gray-300 font-medium">시뮬레이션 진행 중…</span>
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-[#3c4043]/60 bg-gradient-to-br from-[#15192a] to-[#0a0e1a]" />
      <div className="h-48 animate-pulse rounded-xl border border-[#3c4043]/60 bg-gradient-to-br from-[#15192a] to-[#0a0e1a]" />
    </div>
  );
}
