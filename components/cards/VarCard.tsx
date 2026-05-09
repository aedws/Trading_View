"use client";

import IndicatorCard from "../IndicatorCard";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtPct } from "@/lib/format";

export default function VarCard({ report }: { report: AnalysisReport }) {
  const r = report.risk;
  // VaR/CVaR are returned as positive fractions = "loss"
  const tone =
    !isFinite(r.historicalVaR99)
      ? "neutral"
      : r.cvar99 > 0.08
      ? "bad"
      : r.cvar99 > 0.04
      ? "warn"
      : "good";
  const label =
    !isFinite(r.historicalVaR99) ? "—" : r.cvar99 > 0.08 ? "고위험" : r.cvar99 > 0.04 ? "보통" : "저위험";
  const text = !isFinite(r.historicalVaR99)
    ? "데이터가 부족합니다."
    : `100일 중 1일은 최소 ${fmtPct(r.historicalVaR99, 1)} 손실 가능 (역사적). 그 1% 영역의 평균 손실은 ${fmtPct(r.cvar99, 1)}. 이 숫자보다 큰 한 번의 손실을 견딜 수 있는지가 포지션 사이즈의 기준입니다.`;

  return (
    <IndicatorCard
      title="VaR / CVaR (1일 기준)"
      subtitle="RISK · TAIL LOSS"
      big={
        <span className="text-accent-red">
          −{fmtPct(r.historicalVaR95, 1)}
        </span>
      }
      stats={[
        { label: "VaR 95% (역사)", value: `−${fmtPct(r.historicalVaR95, 2)}`, tone: "bad" },
        { label: "VaR 95% (정규)", value: `−${fmtPct(r.parametricVaR95, 2)}`, tone: "bad" },
        { label: "VaR 99%", value: `−${fmtPct(r.historicalVaR99, 2)}`, tone: "bad" },
        { label: "CVaR 95%", value: `−${fmtPct(r.cvar95, 2)}`, tone: "bad" },
        { label: "CVaR 99%", value: `−${fmtPct(r.cvar99, 2)}`, tone: "bad" },
      ]}
      verdict={{ label, tone, text }}
      math={{
        formula:
          "역사적 VaR_α = − percentile_{1−α}(r)\n정규 VaR_α   = −(μ + Φ⁻¹(1−α) · σ)\nCVaR_α (Expected Shortfall) = −E[r | r ≤ −VaR_α]",
        meaning:
          "VaR 95%는 \"평균적으로 20일 중 1일은 이 정도 손실이 나올 수 있다\"는 손실 한계선. CVaR(=Expected Shortfall)은 \"VaR 넘어서 손실이 났을 때, 그 평균 손실은 얼마인가\" — 꼬리 깊숙한 평균 손실. 바젤 III는 VaR 대신 CVaR를 표준으로 채택했습니다.",
        signals:
          "VaR/CVaR는 신호가 아니라 \"포지션 사이즈\"의 입력. 종잣돈 대비 1번의 CVaR 99% 손실로 잃을 수 있는 금액을 본인이 감당할 수 있는 한도(예: 자산의 1~2%)로 제한하는 게 정석.\n\n역사 VaR > 정규 VaR 이면 \"실제 분포의 꼬리가 정규분포보다 두꺼움\" — 정규 가정 모델은 위험 과소평가.",
        caveats:
          "역사적 VaR는 \"과거에 일어난 일이 미래에도 일어난다\"고 가정 — 한 번도 안 겪은 충격은 못 잡습니다. 2020년 3월·2008년 같은 사건이 데이터 안에 있어야 의미가 있어요. 또 VaR는 \"이 한계 이상은 얼마나 큰지\" 모릅니다 — 그래서 CVaR를 같이 봐야 합니다.",
      }}
    />
  );
}
