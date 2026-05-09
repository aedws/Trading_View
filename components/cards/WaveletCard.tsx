"use client";

import IndicatorCard from "../IndicatorCard";
import Bars from "../charts/Bars";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtPct } from "@/lib/format";

export default function WaveletCard({ report }: { report: AnalysisReport }) {
  const w = report.wavelet;
  const items = w.bands.map((label, i) => ({
    label,
    value: w.energies[i] ?? 0,
    color: i < 2 ? "#ef4444" : i < 4 ? "#eab308" : "#22c55e",
  }));
  // dominant scale (ignore NaN — Math.max spreads with NaN corrupt the result)
  let maxIdx = -1;
  let maxVal = -Infinity;
  for (let i = 0; i < w.energies.length; i++) {
    const v = w.energies[i];
    if (!Number.isFinite(v)) continue;
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  const dom = maxIdx >= 0 ? w.bands[maxIdx] : undefined;

  const text = !dom
    ? "데이터가 부족합니다."
    : maxIdx < 2
    ? `에너지가 ${dom} 단기 잡음 대역에 가장 많이 모여 있음 — 일중·일일 노이즈 비중이 큰 종목. 단기 매매보다 ATR 기반 손절·익절을 보수적으로.`
    : maxIdx >= 4
    ? `에너지가 ${dom} 장기 추세 대역에 모여 있음 — 큰 흐름이 가격을 지배. 추세추종에 유리.`
    : `에너지가 ${dom} 중기 스윙 대역에 모여 있음 — 1주~1달짜리 스윙 매매 우호적.`;

  const tone = maxIdx >= 4 ? "good" : maxIdx < 2 ? "warn" : "neutral";

  return (
    <IndicatorCard
      title="Haar 웨이블릿 에너지"
      subtitle="CYCLE · MULTI-SCALE"
      stats={items.map((it, i) => ({
        label: it.label,
        value: fmtPct(it.value, 1),
        tone: i === maxIdx ? "good" : "neutral",
      }))}
      verdict={{
        label: dom ? `${dom} 우세` : "—",
        tone,
        text,
      }}
      math={{
        formula:
          "Haar 단계별 분해:\n  a_k[i] = (s_k[2i] + s_k[2i+1]) / √2   (저주파)\n  d_k[i] = (s_k[2i] − s_k[2i+1]) / √2   (고주파, 디테일)\n레벨 k 디테일 → 대역 ≈ 2^k ~ 2^(k+1) 샘플",
        meaning:
          "신호를 \"여러 시간 스케일\"로 동시에 쪼개서 각 스케일이 전체 분산에 얼마나 기여하는지 봅니다. FFT는 \"전 구간 평균 주기\"만 보지만, 웨이블릿은 \"어느 스케일이 지금 중요한가\"를 직접 알려줍니다.",
        signals:
          "단기(2~8일) 에너지가 60% 이상이면 일중 매매·옵션 만기 효과가 큼 → 스윙 손절 폭 넓혀야 함. 장기(32일+) 에너지가 50% 이상이면 추세추종 전략 우호. 골고루 분포되어 있으면 평소 시장.",
        caveats:
          "Haar는 가장 단순한 웨이블릿이라 \"계단형\" 변화에는 잘 맞지만 부드러운 진동에는 Daubechies(db4)·Morlet 등이 더 적합합니다. 또 에너지는 분산 비중이지 \"수익 기회\"가 아닙니다 — 단기 잡음이 크다고 단기 매매가 잘 된다는 뜻은 아님.",
      }}
    >
      <div className="mt-1">
        <Bars
          items={items}
          height={70}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <div className="text-[9px] text-gray-500 mt-1 text-center">
          빨강=단기 잡음 · 노랑=중기 스윙 · 초록=장기 추세 (거래일 기준)
        </div>
      </div>
    </IndicatorCard>
  );
}
