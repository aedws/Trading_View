"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtPct, fmtNum } from "@/lib/format";

export default function RiskCard({ report }: { report: AnalysisReport }) {
  const r = report.risk;
  const dd = r.drawdownSeries.map((d) => d.dd);

  const sharpeTone = r.sharpe >= 1 ? "good" : r.sharpe >= 0 ? "neutral" : "bad";
  const sharpeLabel =
    r.sharpe >= 2 ? "탁월" : r.sharpe >= 1 ? "우수" : r.sharpe >= 0 ? "평범" : "열위";
  const sharpeText =
    r.sharpe >= 2
      ? `위험 1단위당 ${fmtNum(r.sharpe, 2)}배 초과수익. 헤지펀드 상위급. 데이터 기간 길수록 신뢰성 높음.`
      : r.sharpe >= 1
      ? `위험 1단위당 ${fmtNum(r.sharpe, 2)}배 초과수익. S&P 500 장기 평균(~0.4) 대비 우수.`
      : r.sharpe >= 0
      ? `위험 대비 초과수익이 미미. 무위험자산(국채)과 비슷한 매력.`
      : `무위험자산보다 못한 결과. 보유 정당화가 어려움.`;

  return (
    <IndicatorCard
      title="리스크-조정 수익"
      subtitle="RISK · SHARPE / SORTINO / CALMAR"
      span="wide"
      big={
        <span className={r.sharpe >= 1 ? "text-accent-green" : r.sharpe < 0 ? "text-accent-red" : ""}>
          Sharpe {fmtNum(r.sharpe, 2)}
        </span>
      }
      stats={[
        { label: "연환산 수익", value: fmtPct(r.annualizedReturn, 1), tone: r.annualizedReturn > 0 ? "good" : "bad" },
        { label: "연환산 변동성", value: fmtPct(r.annualizedVol, 1) },
        { label: "Sortino", value: fmtNum(r.sortino, 2), tone: r.sortino >= 1 ? "good" : r.sortino < 0 ? "bad" : "neutral" },
        { label: "Calmar", value: fmtNum(r.calmar, 2), tone: r.calmar >= 0.5 ? "good" : r.calmar < 0 ? "bad" : "neutral" },
        { label: "MDD", value: fmtPct(r.mdd, 1), tone: "bad" },
        { label: "현재 낙폭", value: fmtPct(r.currentDrawdown, 1), tone: r.currentDrawdown < -0.05 ? "bad" : "neutral" },
        { label: "회복일", value: r.daysToRecover != null ? `${r.daysToRecover}일` : "미회복" },
      ]}
      verdict={{ label: sharpeLabel, tone: sharpeTone, text: sharpeText }}
      math={{
        formula:
          "Sharpe  = (E[r] − rf) / σ(r) · √252\nSortino = (E[r] − rf) / σ_↓(r) · √252,  σ_↓ = std(r | r<0)\nMDD     = min_t (P_t / max_{s≤t} P_s − 1)\nCalmar  = CAGR / |MDD|",
        meaning:
          "Sharpe는 위험 1단위(전체 변동성) 당 초과수익. Sortino는 분모를 \"하방 변동성\"만으로 바꿔서 \"좋은 변동성(상방)\"은 페널티에서 제외. Calmar는 \"가장 아팠던 낙폭\" 기준으로 수익을 나눔 — 실제 투자자 체감과 가장 가까움.",
        signals:
          "셋 다 0보다 높으면 보유 정당. 1.0 이상이면 우수. Sortino가 Sharpe의 1.5배 이상이면 \"상승 변동만 큰 종목\"(좋은 신호). 반대면 폭락 위험이 평균을 끌어내리는 종목.",
        caveats:
          "Sharpe는 수익률이 정규분포라고 가정 — 꼬리위험이 큰 종목에선 과대평가됩니다. \"꼬리위험\" 카드의 첨도(kurtosis)가 클수록 Sharpe만으로 판단하면 위험합니다. Calmar는 단 한 번의 큰 낙폭에 좌우되니 데이터 기간이 짧으면 신뢰성 낮음.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 flex items-center justify-between">
          <span>낙폭(drawdown) — 0%가 신고가</span>
          <span>최대 낙폭 {fmtPct(r.mdd, 1)} · {r.daysToRecover != null ? `회복까지 ${r.daysToRecover}일` : "아직 미회복"}</span>
        </div>
        <Sparkline values={dd} color="#ef4444" height={132} zeroLine={0} yMax={0.01} />
      </div>
    </IndicatorCard>
  );
}
