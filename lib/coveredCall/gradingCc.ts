import type { ReinvestMode } from "./dcaSim";
import type { PrincipleHit } from "./principles";

const BANNED = new Set([
  "ULTY",
  "CONY",
  "YBIT",
  "TSLY",
  "YMAX",
  "NFLY",
  "FBY",
  "APLY",
  "MSFO",
  "MSFY",
  "AIYY",
  "MSTY",
  "JPMO",
]);

export type GradeCode =
  | "PERMANENTLY_BANNED"
  | "A++"
  | "A+"
  | "A"
  | "A'"
  | "B"
  | "C1"
  | "C1*"
  | "C2"
  | "D";

export function gradeCoveredCall(input: {
  ticker: string;
  irr: number;
  mdd: number;
  cashOnCash: number;
  /** 원칙 2: 강한 갭 양방향 */
  forceD: boolean;
  /** 원칙 1: 저변동+저수익 */
  forceC2: boolean;
}): { code: GradeCode; reason: string } {
  const t = input.ticker.trim().toUpperCase();
  if (BANNED.has(t)) {
    return { code: "PERMANENTLY_BANNED", reason: "내장 PERMANENTLY_BANNED 리스트" };
  }
  if (input.forceD) {
    return { code: "D", reason: "원칙 2: 갭·급변 패턴 페널티(양방향 극단 빈도)" };
  }
  if (input.forceC2) {
    return {
      code: "C2",
      reason: "원칙 1: 실현변동성 대비 IRR 저조 — 분배 엔진 부족 후보",
    };
  }

  const { irr, mdd, cashOnCash } = input;

  if (irr > 0.35 && mdd > -0.12) {
    return { code: "A++", reason: "고 IRR · 통제된 낙폭 근처" };
  }
  if (irr > 0.28) return { code: "A+", reason: "수익률 우수" };
  if (irr > 0.2) return { code: "A", reason: "수익률 양호" };
  if (irr > 0.14) return { code: "A'", reason: "무난" };
  if (irr > 0.08) return { code: "B", reason: "보통" };
  if (cashOnCash < 0.05) {
    return { code: "C2", reason: "Cash-on-cash 매우 낮음" };
  }
  if (mdd <= -0.35) {
    return { code: "C1*", reason: "과도한 MDD" };
  }
  if (irr > 0.03) return { code: "C1", reason: "저수익" };
  return { code: "D", reason: "부진 또는 추가 검증 필요" };
}

export function principleFlagsFromHits(hits: PrincipleHit[]): {
  forceD: boolean;
  forceC2: boolean;
} {
  const p2 = hits.find((h) => h.id === 2);
  const p1 = hits.find((h) => h.id === 1);
  return {
    forceD: p2?.verdict === "warn",
    forceC2: p1?.verdict === "warn",
  };
}

/** 사용자 선택 시나리오 라벨 */
export function reinvestLabel(m: ReinvestMode): string {
  switch (m) {
    case "no_reinvest":
      return "분배 미재투자 (현금 적립)";
    case "self_reinvest":
      return "자기 재투자";
    case "distill_qqqi70_spyi30":
      return "증류 70% QQQI / 30% SPYI";
    default:
      return String(m);
  }
}
