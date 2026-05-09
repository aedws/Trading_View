"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function HilbertCard({ report }: { report: AnalysisReport }) {
  const h = report.hilbert;
  const series = h.series.map((s) => s.price);
  const env = h.series.map((s) => s.envelope);
  const dom = h.dominantPeriod;

  const text = !isFinite(dom)
    ? "데이터가 부족합니다."
    : `최근 추정 즉시-주기 ≈ ${fmtNum(dom, 1)}일. Hilbert 변환은 \"매일\" 다른 주기를 추정하므로 FFT가 보여주는 \"평균 주기\"와는 다를 수 있어요. 두 값이 비슷하면 그 주기가 안정적이라는 뜻.`;

  return (
    <IndicatorCard
      title="Hilbert 변환 (즉시 주기·진폭)"
      subtitle="CYCLE · ANALYTIC SIGNAL"
      big={
        <span>
          주기 ≈ <span className="text-accent-cyan">{fmtNum(dom, 1)}</span>일
        </span>
      }
      verdict={{ label: "즉시 주기 추정", tone: "neutral", text }}
      math={{
        formula:
          "해석 신호:  z(t) = x(t) + i · H[x](t)\n진폭(엔벨로프) = |z(t)|\n위상 φ(t) = arg(z(t))\n즉시 주기 = 1 / |dφ/dt|",
        meaning:
          "Hilbert 변환은 신호에 \"가상의 90° 위상 짝\"을 만들어 줍니다 (z = x + iH[x]). 그러면 매 시점의 진폭(=현재 변동 크기)과 위상(=주기 안에서의 위치)을 동시에 알 수 있어요 — FFT가 \"평균\"이라면 Hilbert는 \"실시간\".",
        signals:
          "엔벨로프(상한선)가 빠르게 좁아지면 변동성 수축 → 큰 움직임 임박. 위상이 0(또는 2π)에 가까우면 \"주기 안에서의 바닥\"으로 해석되어 매수 타이밍 후보. 다만 잡음에 매우 민감하므로 단독 사용 금지.",
        caveats:
          "Hilbert는 \"신호가 좁은 대역 주파수다\"라고 가정합니다. 주가는 광대역 신호라 즉시 주기가 매우 흔들립니다. 그래서 5~10일 이동평균을 한 번 더 입혀야 의미 있는 값을 얻습니다 (이 카드의 값은 마지막 1/3의 중앙값).",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 flex items-center gap-3">
          <span className="text-accent-blue">─ 가격</span>
          <span className="text-accent-cyan">─ 엔벨로프(진폭)</span>
        </div>
        <Sparkline
          values={series}
          color="#3b82f6"
          height={110}
          overlays={[{ values: env, color: "#06b6d4" }]}
        />
      </div>
    </IndicatorCard>
  );
}
