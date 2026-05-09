import type { QuoteSummary } from "@/lib/bt/yahoo";

export type PrincipleVerdict = "support" | "neutral" | "warn";

export type PrincipleHit = {
  id: number;
  title: string;
  verdict: PrincipleVerdict;
  note: string;
};

const TITLES: Record<number, string> = {
  1: "안 움직이면 죽는다 — IV 부족 시 분배 엔진 위험",
  2: "갭 자산은 카테고리 D 리스크",
  3: "표면 유사성에 속지 말 것 — 변동성 패턴이 IRR 결정",
  4: "분배율과 IRR은 무상관·음의 상관 가능",
  6: "복리 vs 단순 누적 격차",
  8: "분배금 증류(Distillation)로 단일종목 위험 희석",
  14: "DCA–Lump 격차 = 진입 시점·사이클 신호",
  17: "VOO 벤치 부진 = 구조적 약점 신호",
};

export function evaluatePrinciples(input: {
  irr: number;
  realizedVol: number;
  trailingYield: number | null;
  gapBothWay: boolean;
  dcaIrr: number;
  lumpIrr: number;
  vooIrr: number;
  /** 복리 근사 (CAGR 기반 총수익) vs CoC */
  compoundVsSimpleRatio: number;
}): PrincipleHit[] {
  const out: PrincipleHit[] = [];

  const lowVol =
    Number.isFinite(input.realizedVol) && input.realizedVol < 0.12;
  const badEngine =
    lowVol && Number.isFinite(input.irr) && input.irr < 0.06;
  out.push({
    id: 1,
    title: TITLES[1],
    verdict: badEngine ? "warn" : "neutral",
    note: badEngine
      ? "실현변동성이 낮고 IRR도 낮으면 분배 엔진 부족 가능성(교육적 프록시)."
      : "실현변동성·IRR 조합상 분배 엔진 ‘정지’ 패턴은 현재 데이터에서 두드러지지 않음.",
  });

  out.push({
    id: 2,
    title: TITLES[2],
    verdict: input.gapBothWay ? "warn" : "neutral",
    note: input.gapBothWay
      ? "±2% 이상 일간 변동이 양방향으로 잦아 갭·급변 패널티 후보."
      : "극단 갭 빈도는 보통 수준으로 보임(종가 기준 근사).",
  });

  const irrVolNote =
    Number.isFinite(input.irr) && Number.isFinite(input.realizedVol)
      ? `IRR ${(input.irr * 100).toFixed(1)}%, 연 실현변동성 ${(input.realizedVol * 100).toFixed(1)}% — 같은 카테고리라도 패턴이 수익을 가름.`
      : "IRR·변동성 데이터 부족.";
  out.push({
    id: 3,
    title: TITLES[3],
    verdict: "neutral",
    note: irrVolNote,
  });

  const highY =
    input.trailingYield !== null &&
    Number.isFinite(input.trailingYield) &&
    input.trailingYield > 0.15;
  const lowIrr =
    Number.isFinite(input.irr) && input.irr < 0.08;
  out.push({
    id: 4,
    title: TITLES[4],
    verdict: highY && lowIrr ? "warn" : "neutral",
    note:
      highY && lowIrr
        ? "트레일링 분배율은 높은데 IRR이 낮음 — NAV 침식·과세·과거 분배 등 점검 대상(무상관·음상관 가능)."
        : "분배율과 IRR 조합은 레퍼런스 구간에서 극단적이지 않음.",
  });

  const gapDc = input.compoundVsSimpleRatio;

  out.push({
    id: 6,
    title: TITLES[6],
    verdict: Number.isFinite(gapDc) && gapDc > 2.5 ? "warn" : "neutral",
    note: Number.isFinite(gapDc)
      ? `연복리 총수익 근사 ÷ Cash-on-cash 비율 ≈ ${gapDc.toFixed(2)} — 단순 합산 대비 복리 해석 시 주의.`
      : "비교 불가.",
  });

  out.push({
    id: 8,
    title: TITLES[8],
    verdict: "neutral",
    note:
      "증류 시나리오(distill)는 별도 재투자 탭에서 확인 — 단일 종목 현금흐름을 QQQI/SPYI로 분산.",
  });

  const gapDl =
    Number.isFinite(input.dcaIrr) &&
    Number.isFinite(input.lumpIrr)
      ? input.dcaIrr - input.lumpIrr
      : NaN;
  out.push({
    id: 14,
    title: TITLES[14],
    verdict:
      Number.isFinite(gapDl) && Math.abs(gapDl) > 0.05 ? "warn" : "neutral",
    note: Number.isFinite(gapDl)
      ? `DCA IRR − Lump IRR ≈ ${(gapDl * 100).toFixed(2)}%p — 진입 시점·사이클 신호로 참고.`
      : "비교 불가.",
  });

  const vooGap =
    Number.isFinite(input.dcaIrr) &&
    Number.isFinite(input.vooIrr)
      ? input.dcaIrr - input.vooIrr
      : NaN;
  out.push({
    id: 17,
    title: TITLES[17],
    verdict:
      Number.isFinite(vooGap) && vooGap < -0.03 ? "warn" : "neutral",
    note: Number.isFinite(vooGap)
      ? `DCA IRR − VOO IRR ≈ ${(vooGap * 100).toFixed(2)}%p — 강세 구간에서 구조적 열위 가능.`
      : "VOO 비교 불가.",
  });

  return out;
}

export function enrichQuoteContext(qs: QuoteSummary | null): string {
  if (!qs) return "";
  const parts: string[] = [];
  if (qs.longName) parts.push(qs.longName);
  if (qs.dividendYield !== null && Number.isFinite(qs.dividendYield)) {
    parts.push(`트레일링 분배율 약 ${(qs.dividendYield * 100).toFixed(1)}%`);
  }
  return parts.join(" · ");
}
