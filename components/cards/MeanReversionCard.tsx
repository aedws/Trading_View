"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function MeanReversionCard({
  report,
}: {
  report: AnalysisReport;
}) {
  const m = report.meanReversion;
  const spread = m.spreadSeries.map((s) => s.spread);
  const phi = m.phi;
  const half = m.halfLife;

  const tone =
    !isFinite(half)
      ? "neutral"
      : half < 30
      ? "good"
      : half < 90
      ? "warn"
      : "bad";
  const verdictText = !isFinite(half)
    ? "AR(1) 계수가 추정 안 되거나 |φ|≥1 — 평균회귀 가정이 성립하지 않음 (랜덤워크 또는 추세 지속)."
    : half < 30
    ? "추세선까지 빠르게 회귀하는 종목 (~한 달). 단기 역추세 전략에 우호적."
    : half < 90
    ? "회귀까지 1~3개월. 평균회귀 전략은 가능하지만 인내가 필요."
    : `회귀까지 ${Math.round(half)}일. 사실상 추세에 끌려가는 종목 — 평균회귀보다 추세 추종이 유리.`;

  return (
    <IndicatorCard
      title="평균회귀 반감기"
      subtitle="MEAN REVERSION · STATISTICAL"
      big={
        <span>
          {isFinite(half) ? `${fmtNum(half, 0)}일` : "—"}
        </span>
      }
      stats={[
        { label: "AR(1) φ", value: fmtNum(phi, 3) },
        { label: "수렴 안정성", value: isFinite(phi) && Math.abs(phi) < 1 ? "안정" : "불안정", tone: isFinite(phi) && Math.abs(phi) < 1 ? "good" : "bad" },
      ]}
      verdict={{
        label: !isFinite(half)
          ? "회귀 없음"
          : half < 30
          ? "빠른 회귀"
          : half < 90
          ? "보통"
          : "느린 회귀",
        tone,
        text: verdictText,
      }}
      math={{
        formula:
          "잔차 e_t = ln(P_t) − (a + b·t)\nAR(1):  e_t = φ · e_{t-1} + η_t\n반감기 = −ln(2) / ln(φ)   (0 < φ < 1일 때 정의)",
        meaning:
          "장기 회귀선과의 거리(잔차)가 추세선으로 다시 돌아오는 데 걸리는 평균 시간입니다. 짧을수록 \"고무줄처럼\" 잘 돌아오는 종목, 길수록 한번 빠지면 한참 못 돌아오는 종목입니다.",
        signals:
          "반감기 < 30일: 단기 평균회귀(역추세) 전략이 통계적으로 유리. 반감기 ≥ 90일: 추세추종 전략이 더 적합. φ ≥ 1: 거의 랜덤워크 — 어떤 회귀 전략도 통하지 않음.",
        caveats:
          "이 모형은 \"잔차가 정상 시계열(stationary)이다\"라는 가정을 합니다. 구조적 변화(상장폐지 위험, M&A, 정책 변화)가 발생하면 반감기 자체가 무의미해집니다.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500">잔차 (= 가격이 추세선에서 떨어진 정도)</div>
        <Sparkline
          values={spread}
          color="#a855f7"
          height={132}
          zeroLine={0}
        />
      </div>
    </IndicatorCard>
  );
}
