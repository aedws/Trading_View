"use client";

import IndicatorCard from "../IndicatorCard";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function AdxCard({ report }: { report: AnalysisReport }) {
  const a = report.adx.last.adx;
  const p = report.adx.last.plusDI;
  const m = report.adx.last.minusDI;
  const direction = p > m ? "상승" : "하락";
  const tone =
    !isFinite(a)
      ? "neutral"
      : a >= 25
      ? p > m
        ? "good"
        : "bad"
      : "neutral";
  const label =
    !isFinite(a)
      ? "—"
      : a < 20
      ? "추세 없음"
      : a < 25
      ? "약한 추세"
      : a < 50
      ? `강한 추세 (${direction})`
      : `매우 강한 추세 (${direction})`;
  const text = !isFinite(a)
    ? "데이터가 부족합니다."
    : a < 20
    ? "방향성 없는 횡보장. 추세추종 전략은 불리, 박스권 매매가 더 적합."
    : a < 25
    ? "추세가 막 형성되는 단계. 신호로는 약함."
    : a < 50
    ? `명확한 ${direction} 추세. 추세추종(이평선·돌파) 전략 우호적.`
    : `매우 강한 ${direction} 추세. 단, ADX가 70+에서 꺾이면 추세 끝의 신호가 되기도 함 — 신규 진입 자제.`;

  return (
    <IndicatorCard
      title="ADX (14)"
      subtitle="REGIME · TREND STRENGTH"
      big={
        <span className={
          !isFinite(a) ? "" :
          a >= 25 ? (p > m ? "text-accent-green" : "text-accent-red") :
          "text-gray-300"
        }>
          {fmtNum(a, 1)}
        </span>
      }
      stats={[
        { label: "+DI", value: fmtNum(p, 1), tone: "good" },
        { label: "−DI", value: fmtNum(m, 1), tone: "bad" },
        { label: "방향", value: direction, tone: p > m ? "good" : "bad" },
      ]}
      verdict={{ label, tone, text }}
      math={{
        formula:
          "TR = max(H−L, |H−PC|, |L−PC|)\n+DM = (H − H_{prev}) > (L_{prev} − L) 일 때 그 차, 아니면 0\n−DM = 반대\n+DI = 100 · RMA(+DM) / RMA(TR)\n−DI = 100 · RMA(−DM) / RMA(TR)\nDX = 100 · |+DI − −DI| / (+DI + −DI)\nADX = RMA(DX, 14)",
        meaning:
          "Wilder가 만든 \"추세 세기\" 지표. 방향(상승/하락)이 아니라 \"얼마나 한 방향으로 강하게 가고 있는지\"만 측정합니다. 방향은 +DI / −DI로 따로 봅니다.",
        signals:
          "ADX < 20: 추세 없음 → 박스권 전략. 25~50: 강한 추세 → +DI > −DI면 매수, 반대면 매도. 50+에서 꺾임: 추세 정점 가능성, 신규 진입 자제. +DI ↗ −DI 골든크로스 + ADX > 25는 고전적 매수 신호.",
        caveats:
          "ADX는 Wilder의 RMA로 두 번 평활되어 매우 느립니다 (지연 ~28일). 또 \"하락 추세 강함\"과 \"상승 추세 강함\"이 모두 큰 ADX를 만들기 때문에 반드시 +DI/−DI와 함께 봐야 합니다.",
      }}
    >
      <DiBar plusDI={p} minusDI={m} />
    </IndicatorCard>
  );
}

function DiBar({ plusDI, minusDI }: { plusDI: number; minusDI: number }) {
  if (!isFinite(plusDI) || !isFinite(minusDI)) return null;
  const total = plusDI + minusDI;
  if (total <= 0) return null;
  const p = (plusDI / total) * 100;
  const m = (minusDI / total) * 100;
  return (
    <div className="mt-1">
      <div className="flex h-2.5 w-full rounded-full overflow-hidden">
        <div className="bg-accent-green" style={{ width: `${p}%` }} />
        <div className="bg-accent-red" style={{ width: `${m}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
        <span>+DI 우세 (상승)</span>
        <span>−DI 우세 (하락)</span>
      </div>
    </div>
  );
}
