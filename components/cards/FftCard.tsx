"use client";

import IndicatorCard from "../IndicatorCard";
import Sparkline from "../charts/Sparkline";
import type { AnalysisReport } from "@/lib/analyze";
import { fmtNum } from "@/lib/format";

export default function FftCard({ report }: { report: AnalysisReport }) {
  const f = report.fft;
  const top = f.topPeriods.slice(0, 3);
  const dom = top[0]?.period;

  const tone = top.length === 0 ? "neutral" : "neutral";
  const text =
    top.length === 0
      ? "주기를 추출할 만큼의 데이터가 없습니다."
      : `가장 강한 주기 ≈ ${fmtNum(dom, 1)} 거래일 (${fmtNum(dom / 21, 1)}개월). 다음 후보: ${top
          .slice(1)
          .map((p) => `${fmtNum(p.period, 1)}일`)
          .join(", ") || "없음"}. 단, 금융 시계열의 주기는 \"매일 일정\"하지 않고 부드럽게 흐들리므로 정확한 진입·청산보다 \"리듬 감각\" 정도로 활용하세요.`;

  // build a smooth log-scale spectrum line
  const xs = f.spectrum.map((s) => s.period);
  const ys = f.spectrum.map((s) => s.power);
  // Normalize ys for plotting (0..1)
  const maxY = Math.max(...ys, 1e-9);
  const yNorm = ys.map((y) => y / maxY);

  return (
    <IndicatorCard
      title="FFT 파워 스펙트럼"
      subtitle="CYCLE · FOURIER"
      big={
        top[0] ? (
          <span>
            주기 ≈ <span className="text-accent-cyan">{fmtNum(dom, 1)}</span>일
          </span>
        ) : (
          "—"
        )
      }
      stats={top.map((p) => ({
        label: `#${p.rank}`,
        value: `${fmtNum(p.period, 1)}일 (${fmtNum(p.period / 21, 1)}m)`,
      }))}
      verdict={{ label: "주기 후보", tone, text }}
      math={{
        formula:
          "X[k] = Σ_{n=0..N-1} x[n] · e^(−2π·i·k·n/N)\n파워 P[k] = |X[k]|²,  주기 = N / k (샘플)\n전처리: 선형 detrend → Hann window → FFT",
        meaning:
          "수익률을 \"여러 주기 사인파의 합\"으로 분해해서 가장 에너지가 큰 주기를 찾습니다. 비즈니스 사이클(주식: ~21일, ~63일, ~252일 부근에서 종종 피크), 옵션 만기일 효과 등이 보일 수 있습니다.",
        signals:
          "주요 주기를 알면 \"오늘이 그 주기의 어느 위상에 있는지\"를 Hilbert 카드로 같이 봐서 \"바닥 부근/꼭대기 부근\" 추정이 가능합니다. 다만 주식의 주기는 매우 약한 신호라 진입 트리거로는 부족하고, 위험 관리(손절 폭) 보조 정보로 쓰는 게 안전.",
        caveats:
          "FFT는 \"주기가 시간에 따라 변하지 않는다\"고 가정합니다 (정상성). 시장은 정상적이지 않으므로 \"평균적으로 가장 자주 나타나는 주기\"를 보여주는 정도로 해석. 또 detrend·window 처리 방식에 따라 Top 1이 바뀔 수 있습니다.",
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 flex items-center justify-between">
          <span>로그-주기 스펙트럼 (왼쪽=짧은 주기, 오른쪽=긴 주기)</span>
          <span className="text-accent-cyan">파워 ↑</span>
        </div>
        <Sparkline values={yNorm} color="#06b6d4" height={132} />
        <div className="flex justify-between text-[9px] text-gray-500">
          <span>{xs[0] ? `${fmtNum(xs[0], 0)}일` : "—"}</span>
          <span>{xs[Math.floor(xs.length / 2)] ? `${fmtNum(xs[Math.floor(xs.length / 2)], 0)}일` : ""}</span>
          <span>{xs[xs.length - 1] ? `${fmtNum(xs[xs.length - 1], 0)}일` : "—"}</span>
        </div>
      </div>
    </IndicatorCard>
  );
}
