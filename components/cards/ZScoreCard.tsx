"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum, fmtPrice } from "@/lib/format";

export default function ZScoreCard({ report }: { report: AnalysisReport }) {
  const z = report.zscore;
  const last = z.lastValues[z.lastValues.length - 1];
  const zVals = z.lastValues.map((v) => v.z);
  const cur = z.current;
  const tone =
    !isFinite(cur)
      ? "neutral"
      : cur >= 2
      ? "bad"
      : cur <= -2
      ? "good"
      : Math.abs(cur) <= 0.5
      ? "neutral"
      : "warn";

  return (
    <IndicatorCard
      title={`60일 Z-score`}
      subtitle="SHORT-TERM EXTREMES · STATISTICAL"
      big={
        <span>
          z = <span className={cur > 0 ? "text-accent-red" : "text-accent-green"}>
            {fmtNum(cur, 2)}
          </span>
        </span>
      }
      stats={[
        { label: "현재가", value: last ? fmtPrice(last.price, report.meta.currency) : "—" },
        { label: "60d 평균", value: last ? fmtPrice(last.mean, report.meta.currency) : "—" },
        { label: "60d σ", value: last ? fmtNum(last.sd, 2) : "—" },
      ]}
      verdict={{
        label:
          cur >= 2 ? "단기 과열" :
          cur <= -2 ? "단기 과매도" :
          Math.abs(cur) <= 0.5 ? "정상 범위" :
          cur > 0 ? "약한 과열" : "약한 과매도",
        tone,
        text:
          cur >= 2
            ? "최근 60일 평균 대비 2σ 이상 위. 단기 평균회귀 압력이 통계적으로 매우 큼."
            : cur <= -2
            ? "최근 60일 평균 대비 2σ 이상 아래. 단기 반등 확률이 높지만 추세 하락 중이면 더 빠질 수도 있음."
            : Math.abs(cur) <= 0.5
            ? "통계적으로 평범한 자리. 진입 신호 없음."
            : cur > 0
            ? "조금 비싼 자리. 매도까진 X, 추격매수만 자제."
            : "조금 싼 자리. 매수까진 X, 분할 진입 정도가 적당.",
      }}
      math={{
        formula:
          "μ_60 = mean(P_{t-59..t}),  σ_60 = std(P_{t-59..t})\nz_t = (P_t − μ_60) / σ_60",
        meaning:
          "최근 60일 평균과 비교해서 \"지금 가격이 평균에서 표준편차 몇 개만큼 떨어져 있는지\"를 보는 단기 평균회귀 지표입니다. ±1.96이 95% 신뢰구간 경계.",
        signals:
          "z > +2: 대칭 분포 가정 시 상위 2.5% 영역 → 분할 익절. z < −2: 하위 2.5% → 분할 매수. ±1 안쪽이면 통계적으로 의미 있는 자리가 아님.",
        caveats:
          "추세가 강한 종목은 z가 계속 양수일 수 있습니다 (\"비싼 게 맞아\"). 회귀채널과 함께 보면 \"단기·장기 모두 과열인지\"를 교차 검증할 수 있어요.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 flex items-center gap-3">
          <span className="text-accent-blue">z</span>
          <span className="text-gray-500">─ ±2 가이드</span>
        </div>
        <Sparkline
          values={zVals}
          color="#3b82f6"
          height={100}
          zeroLine={0}
          overlays={[
            { values: zVals.map(() => 2), color: "#ef4444", dashed: true },
            { values: zVals.map(() => -2), color: "#22c55e", dashed: true },
          ]}
        />
      </div>
    </IndicatorCard>
  );
}
