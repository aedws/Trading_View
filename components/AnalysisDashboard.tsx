"use client";

import type { AnalysisReport } from "@/lib/analyze";
import RegressionChannelCard from "./cards/RegressionChannelCard";
import ZScoreCard from "./cards/ZScoreCard";
import MeanReversionCard from "./cards/MeanReversionCard";
import HurstCard from "./cards/HurstCard";
import AdxCard from "./cards/AdxCard";
import VolRegimeCard from "./cards/VolRegimeCard";
import AutocorrCard from "./cards/AutocorrCard";
import RiskCard from "./cards/RiskCard";
import VarCard from "./cards/VarCard";
import TailRiskCard from "./cards/TailRiskCard";
import FftCard from "./cards/FftCard";
import HilbertCard from "./cards/HilbertCard";
import WaveletCard from "./cards/WaveletCard";
import { fmtPrice, fmtDate } from "@/lib/format";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-gray-100 tracking-tight">
            {title}
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
        {children}
      </div>
    </section>
  );
}

export default function AnalysisDashboard({
  report,
}: {
  report: AnalysisReport;
}) {
  const m = report.meta;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-gray-100 font-mono">
            {m.ticker}
          </span>
          {m.longName && (
            <span className="text-xs text-gray-400 truncate max-w-xs">
              {m.longName}
            </span>
          )}
        </div>
        <div className="text-2xl font-semibold num">
          {fmtPrice(m.lastPrice, m.currency)}
        </div>
        <div className="text-[11px] text-gray-500">
          {fmtDate(m.firstDate)} → {fmtDate(m.lastDate)} · {m.bars}일
        </div>
      </div>

      <Section
        title="① 통계 패키지 — 가격이 비싼지 싼지를 분포로 본다"
        description="장기 추세선·단기 평균에서 얼마나 떨어져 있는지, 그리고 그 거리가 다시 얼마나 빠르게 좁혀지는지."
      >
        <RegressionChannelCard report={report} />
        <ZScoreCard report={report} />
        <MeanReversionCard report={report} />
      </Section>

      <Section
        title="② 장세 판별 — 지금이 추세 장인지, 박스 장인지, 위기 장인지"
        description="이 시장이 추세추종 전략에 우호적인지 평균회귀 전략에 우호적인지를 결정합니다. 변동성 레짐이 포지션 사이즈를 정합니다."
      >
        <HurstCard report={report} />
        <AdxCard report={report} />
        <VolRegimeCard report={report} />
        <AutocorrCard report={report} />
      </Section>

      <Section
        title="③ 리스크 — 위험 1단위당 얼마나 벌고 있고, 한 번에 얼마까지 잃을 수 있는가"
        description="Sharpe·Sortino·Calmar는 ‘성과의 질’, VaR·CVaR·꼬리위험은 ‘최악의 날’을 측정합니다."
      >
        <RiskCard report={report} />
        <VarCard report={report} />
        <TailRiskCard report={report} />
      </Section>

      <Section
        title="④ 주기 분석 — 시장의 리듬"
        description="가격에 숨어 있는 주기를 푸리에·힐버트·웨이블릿 세 가지 시각으로 분해합니다. 진입 트리거보다는 ‘지금이 어느 박자인지’ 감각용."
      >
        <FftCard report={report} />
        <HilbertCard report={report} />
        <WaveletCard report={report} />
      </Section>

      <div className="text-[10px] text-gray-600 text-center pt-2 pb-6">
        모든 지표는 야후 파이낸스의 일별 종가(배당·분할 조정)로 계산됩니다 · 투자 권유 아님
      </div>
    </div>
  );
}
