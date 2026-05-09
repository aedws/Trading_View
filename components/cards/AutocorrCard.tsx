"use client";

import IndicatorCard from "../IndicatorCard";
import Bars from "../charts/Bars";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function AutocorrCard({ report }: { report: AnalysisReport }) {
  const a = report.autocorr;
  // 95% confidence band: ±1.96/√n  (white-noise approximation)
  const band = 1.96 / Math.sqrt(a.n);
  const items = a.lags.map((lag, i) => ({
    label: String(lag),
    value: a.values[i],
    color:
      Math.abs(a.values[i]) > band
        ? a.values[i] > 0
          ? "#22c55e"
          : "#ef4444"
        : "#475569",
  }));
  // Ljung-Box critical values (chi^2, alpha = 0.05): df=10 → 18.31, df=20 → 31.41
  const crit10 = 18.31;
  const crit20 = 31.41;
  const tone =
    a.q20 > crit20 ? "warn" : a.q10 > crit10 ? "warn" : "neutral";
  const verdictText =
    a.q20 > crit20
      ? `Q(20) = ${fmtNum(a.q20)}이 임계 ${crit20}을 초과 — 수익률에 명확한 직선적 자기상관 존재. 단순 통계 차익(예: lag-1 평균회귀)이 가능할 수 있음.`
      : a.q10 > crit10
      ? `Q(10) = ${fmtNum(a.q10)}이 임계 ${crit10}을 넘어 단기 자기상관 존재. lag 1~5 부근 신호 검토.`
      : `Q 통계량이 임계값 미만 — 수익률은 통계적으로 거의 백색잡음. 단순 lag 기반 예측은 의미 없음.`;
  const label =
    a.q20 > crit20 ? "강한 자기상관" : a.q10 > crit10 ? "약한 자기상관" : "백색잡음";

  return (
    <IndicatorCard
      title="자기상관 (ACF, lag 1-20)"
      subtitle="REGIME · MARKET EFFICIENCY"
      stats={[
        { label: "Q(10)", value: fmtNum(a.q10), tone: a.q10 > crit10 ? "bad" : "good" },
        { label: "Q(20)", value: fmtNum(a.q20), tone: a.q20 > crit20 ? "bad" : "good" },
        { label: "임계 95%", value: `${crit10} / ${crit20}` },
        { label: "샘플 N", value: String(a.n) },
      ]}
      verdict={{ label, tone, text: verdictText }}
      math={{
        formula:
          "ρ_k = Cov(r_t, r_{t-k}) / Var(r_t)\nLjung-Box:  Q(h) = N(N+2) Σ_{k=1..h} ρ_k² / (N − k)\n95% 신뢰밴드 ≈ ±1.96/√N",
        meaning:
          "오늘 수익률이 어제·그제·…의 수익률과 얼마나 상관 있는지 측정합니다. 효율적 시장에선 0에 가깝게 분포해야 합니다. lag 1에서 큰 음수 → 단기 평균회귀, 큰 양수 → 모멘텀.",
        signals:
          "lag 1 ACF > +0.1: 단기 모멘텀(추세 지속). lag 1 ACF < −0.1: 단기 평균회귀(역추세). Q(10)이 18.31 초과면 5% 수준에서 \"수익률이 백색잡음이다\"라는 귀무가설 기각.",
        caveats:
          "수익률은 거의 ACF가 0인데 \"수익률의 절댓값\" 또는 \"수익률 제곱\"의 ACF는 큽니다 (volatility clustering). 즉 \"방향은 예측 불가, 변동성은 예측 가능\"이라는 게 시장의 일반 패턴입니다.",
      }}
    >
      <div className="mt-1">
        <Bars items={items} height={92} zeroLine />
        <div className="flex justify-between text-[9px] text-gray-500 mt-1">
          <span>lag</span>
          <span>색칠 = 95% 밴드 ±{fmtNum(band, 3)} 초과</span>
        </div>
      </div>
    </IndicatorCard>
  );
}
