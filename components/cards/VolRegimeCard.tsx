"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtPct, fmtNum } from "@/lib/format";

export default function VolRegimeCard({ report }: { report: AnalysisReport }) {
  const v = report.volRegime;
  const series = v.series.map((s) => s.ann);
  const cur = v.current;
  const tone =
    !isFinite(cur)
      ? "neutral"
      : v.label === "극단"
      ? "bad"
      : v.label === "상승"
      ? "warn"
      : v.label === "낮음"
      ? "good"
      : "neutral";
  const text = !isFinite(cur)
    ? "데이터가 부족합니다."
    : v.label === "극단"
    ? `현재 변동성이 자체 분포의 상위 5% 안. 위기 국면 또는 이벤트 직후 — 일반적인 진입 타이밍 아님. 손절 폭은 평소보다 1.5~2배 잡아야 합니다.`
    : v.label === "상승"
    ? `변동성이 상위 25% 영역으로 진입. 옵션 매도 전략은 우호, 추세추종은 휩쏘 위험 증가.`
    : v.label === "낮음"
    ? `변동성이 하위 25% — \"고요한 시장\". 큰 움직임이 임박했을 가능성 (volatility clustering). 옵션 매수 전략 우호.`
    : `변동성이 평소 범위 안. 일반적 매매 가능.`;

  return (
    <IndicatorCard
      title="EWMA 변동성 (λ=0.94)"
      subtitle="REGIME · VOLATILITY"
      big={
        <span>
          {fmtPct(cur, 1)}
          <span className="text-[11px] text-gray-500 font-normal ml-1.5">/연</span>
        </span>
      }
      stats={[
        { label: "p25", value: fmtPct(v.p25, 1), tone: "good" },
        { label: "중앙값", value: fmtPct(v.median, 1) },
        { label: "p75", value: fmtPct(v.p75, 1), tone: "neutral" },
        { label: "p95", value: fmtPct(v.p95, 1), tone: "bad" },
        { label: "z", value: fmtNum(v.zscore, 2) },
      ]}
      verdict={{ label: v.label, tone, text }}
      math={{
        formula:
          "σ²_t = λ · σ²_{t-1} + (1 − λ) · r²_{t-1}\nλ = 0.94 (RiskMetrics 일별 표준)\nσ_연 = σ_t · √252",
        meaning:
          "EWMA(지수가중이동평균)는 가까운 변동에 더 큰 가중치를 줘서 \"지금 이 시점의 변동성\"을 추정합니다. λ=0.94는 GARCH(1,1)의 ω=0, α=0.06, β=0.94 특수해와 동치 — JP모건 RiskMetrics가 1990년대부터 표준으로 쓰는 값입니다.",
        signals:
          "변동성 자체는 매수/매도 신호가 아니라 \"포지션 사이즈와 손절 폭을 조정하라\"는 신호입니다. 극단 구간에선 평소의 절반 사이즈로, 낮은 구간에선 평소대로. ATR 기반 손절도 자동으로 이를 반영합니다.",
        caveats:
          "EWMA는 평균이 0이라고 가정합니다. 강한 추세가 있는 종목에선 변동성이 약간 과대 추정될 수 있습니다. 또 \"이번 변동성이 다음 1일\"을 예측하는 모형이라, 1주~1달짜리 예측에는 GARCH가 더 정확합니다.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500">연환산 변동성 (최근 ~3년)</div>
        <Sparkline
          values={series}
          color="#eab308"
          height={100}
          overlays={[
            { values: series.map(() => v.median), color: "#6b7280", dashed: true },
            { values: series.map(() => v.p95), color: "#ef4444", dashed: true },
          ]}
        />
      </div>
    </IndicatorCard>
  );
}
