"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtPct, fmtNum } from "@/lib/format";

export default function RegressionChannelCard({
  report,
}: {
  report: AnalysisReport;
}) {
  const r = report.regressionChannel;
  const prices = report.pricesForChart.map((p) => p.close);
  const mid = r.series.map((s) => s.mid);
  const up2 = r.series.map((s) => s.up2);
  const dn2 = r.series.map((s) => s.dn2);
  const up1 = r.series.map((s) => s.up1);
  const dn1 = r.series.map((s) => s.dn1);

  const z = r.lastZ;
  const tone =
    !isFinite(z)
      ? "neutral"
      : z >= 1.5
      ? "bad"
      : z <= -1.5
      ? "good"
      : Math.abs(z) <= 0.5
      ? "neutral"
      : "warn";
  const verdictText = !isFinite(z)
    ? "회귀가 적합되지 않았습니다."
    : z >= 1.5
    ? "장기 추세선보다 위쪽 1.5σ를 넘었습니다. 통계적으로 비싼 구간 — 단기 평균회귀 가능성에 유의."
    : z <= -1.5
    ? "장기 추세선 대비 아래쪽 1.5σ 이상. 통계적으로 저평가 영역에 가깝습니다 (단, 추세 자체가 꺾인 게 아닌지 별도 확인)."
    : Math.abs(z) <= 0.5
    ? "추세선 근처. 가격이 장기 균형선과 일치 — 통계적 우위 없음."
    : z > 0
    ? "추세선보다 약간 위. 평범하게 비싼 정도."
    : "추세선보다 약간 아래. 평범하게 싼 정도.";

  return (
    <IndicatorCard
      title="로그-선형 회귀 채널"
      subtitle="LONG-TERM TREND · STATISTICAL"
      span="wide"
      big={
        <span>
          z = <span className={z > 0 ? "text-accent-red" : "text-accent-green"}>
            {fmtNum(z, 2)}
          </span>
        </span>
      }
      stats={[
        { label: "추정 CAGR", value: fmtPct(r.cagr, 1), tone: r.cagr > 0 ? "good" : "bad" },
        { label: "R²", value: fmtNum(r.r2, 3) },
        { label: "잔차 σ", value: fmtNum(r.sigma, 3) },
        { label: "기울기 b/일", value: fmtNum(r.b, 5) },
      ]}
      verdict={{
        label:
          z >= 1.5 ? "비싼 영역" :
          z <= -1.5 ? "싼 영역" :
          Math.abs(z) <= 0.5 ? "균형" :
          z > 0 ? "약간 위" : "약간 아래",
        tone,
        text: verdictText,
      }}
      math={{
        formula: "ln(P_t) = a + b · t + ε,   잔차 σ = std(ε)\n채널: exp(a + b·t) ± k·σ  (k = 1, 2)\nCAGR = exp(b · 252) − 1",
        meaning:
          "가격에 로그를 씌우면 복리 성장이 직선이 됩니다. 그 직선(추세)과 직선에서 떨어진 정도(σ)로 가격이 \"역사적 추세선 대비 얼마나 비싼/싼지\"를 측정합니다.",
        signals:
          "z ≥ +2σ: 통계적 과열 → 분할 익절 후보. z ≤ −2σ: 과매도 → 분할 매수 후보. R²가 0.7 이상이어야 추세 자체가 신뢰됨. R²가 낮으면 \"추세가 없는 종목\"이라는 뜻.",
        caveats:
          "이 모형은 \"이 회사가 앞으로도 같은 속도로 성장한다\"는 가정에 의존합니다. 펀더멘털이 깨진 종목(예: 사양산업·구조적 손실)에서는 추세선 자체가 무의미해집니다.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 flex items-center gap-3">
          <span>가격</span>
          <span className="text-accent-blue">─ 추세선</span>
          <span className="text-accent-purple">─ ±1σ</span>
          <span className="text-gray-500">─ ±2σ</span>
        </div>
        <Sparkline
          values={prices}
          band={{ upper: up2, lower: dn2, color: "#94a3b8" }}
          overlays={[
            { values: mid, color: "#3b82f6" },
            { values: up1, color: "#a855f7", dashed: true },
            { values: dn1, color: "#a855f7", dashed: true },
          ]}
          color="#e5e7eb"
          height={132}
        />
      </div>
    </IndicatorCard>
  );
}
