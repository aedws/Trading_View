import { fetchPrices, fetchQuoteSummary } from "@/lib/bt/yahoo";

import {
  type DayBar,
  type ReinvestMode,
  simulateDca,
  simulateLumpSum,
} from "./dcaSim";
import {
  gradeCoveredCall,
  principleFlagsFromHits,
  reinvestLabel,
} from "./gradingCc";
import {
  alignCloseByDate,
  cagrFromWealth,
  dividendIntervals,
  downsideVsBenchStats,
  maxDrawdown,
  percentile,
  realizedVolAnnual,
  slidingWindowReturns,
  wealthActive,
} from "./metricsCc";
import {
  fillPortfolioPromptTemplate,
  formatWeightedYieldFromTrailing,
} from "./portfolioPromptTemplate";
import {
  enrichQuoteContext,
  evaluatePrinciples,
  type DownsideVsBenchInput,
  type PrincipleHit,
} from "./principles";
import { buildDcaDates } from "./schedule";
import { computeXirr } from "./xirr";

const REINVEST_MODES: ReinvestMode[] = [
  "no_reinvest",
  "self_reinvest",
  "distill_qqqi70_spyi30",
];

export type ScenarioMetrics = {
  reinvest: ReinvestMode;
  label: string;
  irr: number;
  mdd: number;
  cagr: number;
  cashOnCash: number;
  contributed: number;
  terminalWealth: number;
  xirrPercent: number;
  mddPercent: number;
  cagrPercent: number;
  cocPercent: number;
  distFreqLabel: string;
  distMedianDays: number;
  slideMean: number;
  slideP10: number;
  slideP50: number;
  slideP90: number;
  lumpIrr: number;
  lumpTerminal: number;
  vooIrr: number;
  vooTerminal: number;
};

export type CoveredCallAnalysisResult = {
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

async function buildDayBars(
  ticker: string,
  start: string,
  end: string,
): Promise<{ bars: DayBar[]; divDates: string[] }> {
  const { rawPrices, dividends, splits } = await fetchPrices({
    ticker: ticker.trim().toUpperCase(),
    mode: "custom",
    start,
    end,
  });

  const closeByDate = new Map<string, number>();
  for (const r of rawPrices) {
    if (typeof r.rawClose === "number" && Number.isFinite(r.rawClose) && r.rawClose > 0) {
      closeByDate.set(r.date, r.rawClose);
    }
  }

  const divBy = new Map<string, number>();
  for (const d of dividends) {
    divBy.set(d.date, (divBy.get(d.date) ?? 0) + d.amount);
  }

  const splitBy = new Map<string, number>();
  for (const s of splits) {
    splitBy.set(s.date, (splitBy.get(s.date) ?? 1) * s.ratio);
  }

  const dates = [...closeByDate.keys()].sort();
  if (dates.length < 20) {
    throw new Error(`거래일 데이터가 너무 적습니다 (${dates.length}일).`);
  }

  const bars: DayBar[] = dates.map((date) => ({
    date,
    close: closeByDate.get(date)!,
    splitMult: splitBy.get(date) ?? 1,
    dividendPerShare: divBy.get(date) ?? 0,
  }));

  const divDates = [...divBy.keys()]
    .filter((d) => (divBy.get(d) ?? 0) > 0)
    .sort();

  return { bars, divDates };
}

function alignRawSeries(
  primaryDates: string[],
  rawPrices: { date: string; rawClose: number }[],
): number[] {
  const m = new Map<string, number>();
  for (const r of rawPrices) {
    if (typeof r.rawClose === "number" && r.rawClose > 0) {
      m.set(r.date, r.rawClose);
    }
  }
  let last = 0;
  return primaryDates.map((d) => {
    const v = m.get(d);
    if (v !== undefined && Number.isFinite(v) && v > 0) {
      last = v;
      return v;
    }
    return last;
  });
}

function scenarioMetrics(
  bars: DayBar[],
  dcaDates: Set<string>,
  periodAmount: number,
  mode: ReinvestMode,
  distill: { leg1: number[]; leg2: number[] } | undefined,
  vooBars: DayBar[],
  distLabel: string,
  distMed: number,
): ScenarioMetrics {
  const dca = simulateDca(bars, dcaDates, periodAmount, mode, distill);
  const irr = computeXirr(
    dca.flows.map((f) => ({ date: f.date, amount: f.amount })),
  );
  const wAct = wealthActive(dca.wealth);
  const dd = wAct.length ? dca.wealth.length - wAct.length : 0;
  const startIso = dca.dates[dd] ?? dca.dates[0] ?? "";
  const endIso = dca.dates[dca.dates.length - 1] ?? "";
  const mdd = maxDrawdown(wAct.length ? wAct : dca.wealth);
  const cagr = cagrFromWealth(wAct.length ? wAct : dca.wealth, startIso, endIso);
  const coc =
    dca.contributed > 1e-9
      ? (dca.terminalWealth - dca.contributed) / dca.contributed
      : NaN;

  const win = Math.min(
    252,
    Math.max(42, Math.floor(dca.wealth.length / 3)),
  );
  const slidRaw = slidingWindowReturns(dca.wealth, win);
  const slid = [...slidRaw].sort((a, b) => a - b);
  const lump = simulateLumpSum(bars, dca.contributed, mode, distill);
  const lumpIrr = computeXirr(lump.flows.map((f) => ({ date: f.date, amount: f.amount })));

  const vooDca = simulateDca(vooBars, dcaDates, periodAmount, mode, undefined);
  const vooIrr = computeXirr(
    vooDca.flows.map((f) => ({ date: f.date, amount: f.amount })),
  );

  return {
    reinvest: mode,
    label: reinvestLabel(mode),
    irr,
    mdd,
    cagr,
    cashOnCash: coc,
    contributed: dca.contributed,
    terminalWealth: dca.terminalWealth,
    xirrPercent: irr * 100,
    mddPercent: mdd * 100,
    cagrPercent: cagr * 100,
    cocPercent: coc * 100,
    distFreqLabel: distLabel,
    distMedianDays: distMed,
    slideMean: slidRaw.length
      ? slidRaw.reduce((s, x) => s + x, 0) / slidRaw.length
      : NaN,
    slideP10: percentile(slid, 10),
    slideP50: percentile(slid, 50),
    slideP90: percentile(slid, 90),
    lumpIrr,
    lumpTerminal: lump.terminalWealth,
    vooIrr,
    vooTerminal: vooDca.terminalWealth,
  };
}

export async function runCoveredCallAnalysis(params: {
  ticker: string;
  start: string;
  end: string;
  periodAmount: number;
  freq: string;
  primaryMode: ReinvestMode;
  benchmark?: string;
}): Promise<CoveredCallAnalysisResult> {
  const ticker = params.ticker.trim().toUpperCase();
  const bench = (params.benchmark ?? "VOO").trim().toUpperCase();
  const { bars, divDates } = await buildDayBars(ticker, params.start, params.end);
  const calendar = bars.map((b) => b.date);
  const dcaDates = buildDcaDates(calendar, params.start, params.end, params.freq);

  const [leg1Data, leg2Data, qs] = await Promise.all([
    fetchPrices({
      ticker: "QQQI",
      mode: "custom",
      start: params.start,
      end: params.end,
    }),
    fetchPrices({
      ticker: "SPYI",
      mode: "custom",
      start: params.start,
      end: params.end,
    }),
    fetchQuoteSummary(ticker),
  ]);

  const distillSeries = {
    leg1: alignRawSeries(calendar, leg1Data.rawPrices),
    leg2: alignRawSeries(calendar, leg2Data.rawPrices),
  };

  const { bars: vooBars } = await buildDayBars(bench, params.start, params.end);

  const { label: distLabel, medianDays: distMed } = dividendIntervals(divDates);

  const scenarios: Record<string, ScenarioMetrics> = {};
  for (const mode of REINVEST_MODES) {
    const distill =
      mode === "distill_qqqi70_spyi30" ? distillSeries : undefined;
    scenarios[mode] = scenarioMetrics(
      bars,
      dcaDates,
      params.periodAmount,
      mode,
      distill,
      vooBars,
      distLabel,
      distMed,
    );
  }

  const primary = scenarios[params.primaryMode];
  if (!primary) {
    throw new Error("primaryMode invalid");
  }

  const closes = bars.map((b) => b.close);
  const rv = realizedVolAnnual(closes);
  const aligned = alignCloseByDate(bars, vooBars);
  const downsideVsBench = downsideVsBenchStats(
    aligned.asset,
    aligned.bench,
    bench,
  );
  const trailingYield = qs?.dividendYield ?? null;

  const years =
    (new Date(params.end + "T12:00:00Z").getTime() -
      new Date(params.start + "T12:00:00Z").getTime()) /
    (365.25 * 86400000);
  const compoundApprox =
    Number.isFinite(primary.cagr) && years > 0
      ? Math.pow(1 + primary.cagr, years) - 1
      : NaN;
  const compoundVsSimple =
    Number.isFinite(compoundApprox) &&
    Number.isFinite(primary.cashOnCash) &&
    Math.abs(primary.cashOnCash) > 1e-9
      ? compoundApprox / primary.cashOnCash
      : NaN;

  const principles = evaluatePrinciples({
    irr: primary.irr,
    realizedVol: rv,
    trailingYield,
    downsideVsBench,
    dcaIrr: primary.irr,
    lumpIrr: primary.lumpIrr,
    vooIrr: primary.vooIrr,
    compoundVsSimpleRatio: compoundVsSimple,
  });

  const { forceD, forceC2 } = principleFlagsFromHits(principles);
  const grade = gradeCoveredCall({
    ticker,
    irr: primary.irr,
    mdd: primary.mdd,
    cashOnCash: primary.cashOnCash,
    forceD,
    forceC2,
  });

  const quoteNote = enrichQuoteContext(qs);

  const md = buildMarkdown({
    ticker,
    params,
    primary,
    scenarios,
    grade,
    principles,
    quoteNote,
    rv,
    downsideVsBench,
    compoundVsSimple,
  });

  const analysisMonths = Math.max(
    1,
    Math.round(
      (new Date(params.end + "T12:00:00Z").getTime() -
        new Date(params.start + "T12:00:00Z").getTime()) /
        (30.44 * 86400000),
    ),
  );

  const aiPrompt = fillPortfolioPromptTemplate({
    auto_generated_portfolio_report:
      md +
      "\n\n---\n*단일 티커 자동 리포트. 다자산 포트폴리오 시 가중 분배율·섹터 HHI·운용사 수 등은 별도 산출.* " +
      `분석 구간 약 **${analysisMonths}개월**.`,
    weighted_yield: formatWeightedYieldFromTrailing(trailingYield),
    phase_2_expected: "—",
    year5_distill: "—",
    sector_hhi: "N/A (단일 자산)",
    mech_diversity: "N/A (단일 자산)",
    operator_count: "N/A (단일 자산)",
  });

  return {
    ticker,
    start: params.start,
    end: params.end,
    periodAmount: params.periodAmount,
    freq: params.freq,
    primaryMode: params.primaryMode,
    longName: qs?.longName ?? qs?.shortName ?? null,
    quoteNote,
    scenarios,
    grade,
    principles,
    markdownReport: md,
    aiPrompt,
  };
}

function buildMarkdown(ctx: {
  ticker: string;
  params: {
    start: string;
    end: string;
    periodAmount: number;
    freq: string;
    primaryMode: ReinvestMode;
  };
  primary: ScenarioMetrics;
  scenarios: Record<string, ScenarioMetrics>;
  grade: { code: string; reason: string };
  principles: PrincipleHit[];
  quoteNote: string;
  rv: number;
  downsideVsBench: DownsideVsBenchInput;
  compoundVsSimple: number;
}): string {
  const p = ctx.params;
  const fmt = (x: number) =>
    Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : "—";
  const pp = (x: number) =>
    Number.isFinite(x) ? `${(x * 100).toFixed(2)}%p` : "—";
  const dvb = ctx.downsideVsBench;
  const lines = [
    `# 커버드콜 DCA 분석 \`${ctx.ticker}\``,
    "",
    "## 입력",
    `- 구간: **${p.start}** ~ **${p.end}**`,
    `- 적립: **$${p.periodAmount}** · 빈도 **${p.freq}** · 시나리오 **${reinvestLabel(p.primaryMode)}**`,
    ctx.quoteNote ? `- 메타: ${ctx.quoteNote}` : "",
    "",
    "## 선택 시나리오 지표",
    "",
    "| 지표 | 값 |",
    "| --- | --- |",
    `| IRR(XIRR) | ${fmt(ctx.primary.irr)} |`,
    `| MDD | ${fmt(ctx.primary.mdd)} |`,
    `| CAGR(자산) | ${fmt(ctx.primary.cagr)} |`,
    `| Cash-on-cash | ${fmt(ctx.primary.cashOnCash)} |`,
    `| 납입 합계 | $${ctx.primary.contributed.toFixed(2)} |`,
    `| 종료 자산 | $${ctx.primary.terminalWealth.toFixed(2)} |`,
    `| 분배 간격 | ${ctx.primary.distFreqLabel} (${Number.isFinite(ctx.primary.distMedianDays) ? ctx.primary.distMedianDays.toFixed(1) : "—"}일 중앙값) |`,
    `| 슬라이딩 수익 평균 | ${fmt(ctx.primary.slideMean)} · p10–p90 ${fmt(ctx.primary.slideP10)} … ${fmt(ctx.primary.slideP90)} |`,
    `| Lump-sum IRR | ${fmt(ctx.primary.lumpIrr)} · 종료 $${ctx.primary.lumpTerminal.toFixed(2)} |`,
    `| VOO 벤치 DCA IRR | ${fmt(ctx.primary.vooIrr)} · 종료 $${ctx.primary.vooTerminal.toFixed(2)} |`,
    "",
    "## 3가지 재투자 시나리오 요약",
    ...REINVEST_MODES.map(
      (m) =>
        `- **${reinvestLabel(m)}**: IRR ${fmt(ctx.scenarios[m].irr)} · MDD ${fmt(ctx.scenarios[m].mdd)} · CoC ${fmt(ctx.scenarios[m].cashOnCash)}`,
    ),
    "",
    "## 메커니즘 프록시",
    `- 연 실현변동성(일간 로그수익): ${Number.isFinite(ctx.rv) ? (ctx.rv * 100).toFixed(1) + "%" : "—"}`,
    "",
    `### 벤치마크(**${dvb.benchLabel}**) 대비 하방 (일간 종가, 자산 하락일만 지표화)`,
    `- 비교 가능 일간 구간: **${dvb.tradingIntervals}**개`,
    `- 자산 **하락일** 초과수익률(자산 일간수익률 − 벤치 일간수익률) 중앙값: **${pp(dvb.medianExcessWhenAssetDown)}** (음수면 그날 벤치보다 더 하락)`,
    `- 전체 일간 중 자산 하락이 벤치보다 더 큰 날 비율: ${Number.isFinite(dvb.excessDownVsBenchShare) ? (dvb.excessDownVsBenchShare * 100).toFixed(1) + "%" : "—"}`,
    `- 하락일 중 벤치 대비 **1%p 이상** 추가 하락 비율: ${Number.isFinite(dvb.severeExcessDownShare) ? (dvb.severeExcessDownShare * 100).toFixed(1) + "%" : "—"}`,
    `- 원칙 2(갭·하방) 경고: **${dvb.distress ? "예" : "아니오"}**`,
    `- 복리총수익근사/CoC 비율: ${Number.isFinite(ctx.compoundVsSimple) ? ctx.compoundVsSimple.toFixed(2) : "—"}`,
    "",
    `## 등급: **${ctx.grade.code}**`,
    ctx.grade.reason,
    "",
    "### 원칙 체크(발췌)",
    ...ctx.principles.map(
      (h) =>
        `- **${h.id}** ${h.title} → ${h.verdict}: ${h.note}`,
    ),
    "",
    "---",
    "*야후 일봉·분배·분할 기준 교육용 모델. 세금·수수료·슬리피지·실제 옵션 IV 미반영.*",
  ];
  return lines.filter(Boolean).join("\n");
}

