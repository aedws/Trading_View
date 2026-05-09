"use client";

import IndicatorCard from "../IndicatorCard";
import Bars from "../charts/Bars";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum, fmtPct } from "@/lib/format";

export default function TailRiskCard({ report }: { report: AnalysisReport }) {
  const t = report.tail;
  const items = t.bins.map((b, i) => ({
    label: i % 8 === 0 ? `${(b.mid * 100).toFixed(1)}%` : "",
    value: b.count,
    color:
      b.mid < -0.05 ? "#ef4444" : b.mid > 0.05 ? "#22c55e" : "#475569",
  }));
  const skew = t.skew;
  const kurt = t.exKurt;
  const tone =
    !isFinite(kurt)
      ? "neutral"
      : kurt > 6
      ? "bad"
      : kurt > 3
      ? "warn"
      : "neutral";
  const text = !isFinite(kurt)
    ? "데이터 부족."
    : `과잉첨도 ${fmtNum(kurt, 1)} ${
        kurt > 3
          ? "→ 정규분포보다 꼬리가 두꺼움. 큰 손익이 평소보다 자주 일어남."
          : "→ 정규분포 수준의 꼬리 두께."
      } 좌측 꼬리(5%)는 ${fmtPct(t.leftTail, 2)}, 우측 꼬리(95%)는 ${fmtPct(
        t.rightTail,
        2
      )} — 비율 ${fmtNum(t.tailRatio, 2)}배 ${
        t.tailRatio > 1.2
          ? "(하락 충격이 더 큼)"
          : t.tailRatio < 0.8
          ? "(상승 충격이 더 큼)"
          : "(좌우 균형)"
      }.`;

  return (
    <IndicatorCard
      title="꼬리위험 (수익률 분포)"
      subtitle="RISK · DISTRIBUTION SHAPE"
      stats={[
        { label: "왜도", value: fmtNum(skew, 2), tone: skew < -0.5 ? "bad" : skew > 0.5 ? "good" : "neutral" },
        { label: "과잉첨도", value: fmtNum(kurt, 2), tone: kurt > 3 ? "bad" : "neutral" },
        { label: "좌측 5%", value: `−${fmtPct(t.leftTail, 2)}`, tone: "bad" },
        { label: "우측 95%", value: fmtPct(t.rightTail, 2), tone: "good" },
        { label: "꼬리비율 L/R", value: fmtNum(t.tailRatio, 2), tone: t.tailRatio > 1.2 ? "bad" : "neutral" },
      ]}
      verdict={{
        label: kurt > 6 ? "꼬리 매우 두꺼움" : kurt > 3 ? "꼬리 두꺼움" : "정상 분포",
        tone,
        text,
      }}
      math={{
        formula:
          "왜도(skew) = E[((r−μ)/σ)³]\n과잉첨도(excess kurtosis) = E[((r−μ)/σ)⁴] − 3\n꼬리비율 = |percentile_5(r)| / percentile_95(r)",
        meaning:
          "수익률이 정규분포(종 모양)에서 얼마나 어긋나는지 보는 지표. 왜도 음수 = 큰 손실(왼쪽 꼬리)이 큰 이익보다 자주 일어남. 과잉첨도 양수 = 정규보다 \"평소엔 잠잠하다 가끔 폭주\"하는 패턴 (=대부분 자산의 실제 모습).",
        signals:
          "정규 가정 모델(Sharpe·정규 VaR·BS 옵션가)은 첨도가 클수록 위험을 과소평가합니다. 첨도 > 3이면 표준편차 σ × 3을 \"99.7% 안전\"이 아니라 \"95~98% 안전\" 정도로 봐야 함. 왜도 < −1이면 \"평소엔 조금씩 벌고 가끔 크게 잃는\" 패턴 — 분할매수·헤지 필수.",
        caveats:
          "왜도·첨도는 표본 사이즈에 매우 민감하고, 단 하나의 큰 값(예: 코로나 첫날)이 전체 숫자를 좌우합니다. 그래서 \"수치\"보단 \"방향\"으로 읽는 게 안전합니다.",
      }}
    >
      <div className="mt-1">
        <Bars items={items} height={70} />
        <div className="text-[9px] text-gray-500 mt-1">
          일별 수익률 히스토그램 — 가운데가 0%, 좌측이 손실, 우측이 이익
        </div>
      </div>
    </IndicatorCard>
  );
}
