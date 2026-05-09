"use client";

import IndicatorCard from "../IndicatorCard";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function HurstCard({ report }: { report: AnalysisReport }) {
  const H = report.hurst.H;
  const r2 = report.hurst.r2;
  const tone =
    !isFinite(H)
      ? "neutral"
      : H >= 0.6
      ? "good"
      : H <= 0.4
      ? "warn"
      : "neutral";
  const label =
    !isFinite(H)
      ? "—"
      : H >= 0.6
      ? "추세 (지속성)"
      : H <= 0.4
      ? "평균회귀 (반-지속)"
      : "랜덤워크";
  const text = !isFinite(H)
    ? "데이터 길이가 부족합니다."
    : H >= 0.6
    ? "한 번 오르면 계속 오르고, 한 번 내리면 계속 내리는 경향. 추세추종 전략(돌파·이평선)이 통계적 우위."
    : H <= 0.4
    ? "오른 다음 내리고, 내린 다음 오르는 경향. 역추세·평균회귀 전략(±2σ 매매)이 우위."
    : "수익률이 거의 독립 — 효율적 시장 가설에 가까운 영역. 어떤 단순 추세/회귀 전략도 통계적 우위 없음.";

  return (
    <IndicatorCard
      title="Hurst 지수 (R/S)"
      subtitle="REGIME · LONG MEMORY"
      big={
        <span className={
          !isFinite(H) ? "" :
          H >= 0.6 ? "text-accent-green" :
          H <= 0.4 ? "text-accent-yellow" :
          "text-gray-300"
        }>
          H = {fmtNum(H, 3)}
        </span>
      }
      stats={[
        { label: "회귀 R²", value: fmtNum(r2, 3) },
        { label: "기준선", value: "0.5" },
      ]}
      verdict={{ label, tone, text }}
      math={{
        formula:
          "각 윈도우 길이 n에서:\n  R(n)/S(n) = (max누적편차 − min누적편차) / std\n로그-로그 회귀:\n  ln(E[R/S]) = c + H · ln(n)",
        meaning:
          "수익률 시계열이 \"기억\"을 갖는지 측정합니다. H=0.5는 동전 던지기(완전 랜덤), H>0.5는 추세 지속, H<0.5는 반-지속(평균회귀). 효율적 시장에서는 H가 0.5 근처여야 함.",
        signals:
          "H ≥ 0.6: 추세추종 알고리즘 (돌파, MA cross). H ≤ 0.4: 평균회귀 알고리즘 (Z-score, BB). 0.45~0.55: 단순 룰로는 우위 없음 — 다른 정보(매크로·이벤트)에 의존해야 함.",
        caveats:
          "R/S는 윈도우 선정·잡음에 민감합니다. R²가 0.9 이하면 H 추정의 신뢰도도 낮아집니다. 또한 H는 \"평균적\" 성질이라 특정 구간(위기·랠리)에선 정반대로 나올 수도 있습니다.",
      }}
    >
      <HurstScale value={H} />
    </IndicatorCard>
  );
}

function HurstScale({ value }: { value: number }) {
  const v = isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
  return (
    <div className="mt-1">
      <div className="relative h-2.5 w-full rounded-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #eab308 0%, #eab308 40%, #6b7280 45%, #6b7280 55%, #22c55e 60%, #22c55e 100%)",
          }}
        />
        {isFinite(value) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-white"
            style={{ left: `${v * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
        <span>0.0 평균회귀</span>
        <span>0.5 랜덤</span>
        <span>1.0 추세</span>
      </div>
    </div>
  );
}
