/**
 * LLM용 포트폴리오 분석 요청 템플릿.
 * 플레이스홀더는 `fillPortfolioPromptTemplate`에서 치환합니다.
 */
export const PORTFOLIO_PROMPT_TEMPLATE = `
{auto_generated_portfolio_report}

---

## 포트폴리오 프레임 분석 요청

### 정량 분석 (백테스터 보완)

1. 가중평균 분배율 {weighted_yield}%이 포트폴리오 목적에 적정한가.
2. Phase 진입 시점 시뮬레이션 결과 ({phase_2_expected}개월) 현실성.
3. 시간 진화 시뮬레이션 (5년 후 증류 풀 {year5_distill}%) 합리성.

### 정성 분석 (AI 핵심 영역)

4. **메커니즘 분산 평가**: 포트폴리오 자산들의 메커니즘 분포가 분산 효과를 만드는가, 동조 효과를 만드는가?

5. **사이클 분산 평가**: 다음 사이클 커버리지 평가:
   - AI 컴퓨팅 사이클
   - AI 전력 인프라 사이클
   - 인플레/유가 사이클
   - 위기 헷지 사이클
   - 금리 사이클
   - 혁신 사이클

6. **자산 간 중복 노출**: 정성적 중복 (사이클 동조, 매크로 동조) 평가.

7. **약세장 시나리오**: 모든 자산이 같은 약세장 시 동시 하락 위험, MDD 추정, 분배 행태.

8. **추가 자산 검토**:
   - 코어 자산 변경 후보
   - 위성 자산 추가 후보
   - 시장에 부재한 자산 (출시 대기)

9. **22개 원칙 적용 점검**: 포트폴리오 구조가 어느 원칙을 충족/위반하는가.

### 거주국 관점

10. **세제 영향**: 가중평균 분배율 × 배당소득세율 + 종합과세 임계.
11. **환율 변수**: 포트폴리오 통화 노출 분석.

### 의사결정 권고

12. **현 포트폴리오 유지 vs 변경**: 데이터 + 정성 종합 판단.
13. **다음 모니터링 변수**: 어떤 신호가 포트폴리오 변경 트리거인가.

> 백테스터 자동 분산 점수: 섹터 HHI {sector_hhi}, 메커니즘 다양성 {mech_diversity}, 운용사 {operator_count}
`.trimStart();

export type PortfolioPromptVars = {
  auto_generated_portfolio_report: string;
  /** 숫자만 (템플릿에 이미 % 포함) */
  weighted_yield: string;
  /** 예: "24" 또는 "—" */
  phase_2_expected: string;
  /** 숫자만 (템플릿에 이미 % 포함) */
  year5_distill: string;
  sector_hhi: string;
  mech_diversity: string;
  operator_count: string;
};

const PLACEHOLDER_KEYS: (keyof PortfolioPromptVars)[] = [
  "auto_generated_portfolio_report",
  "weighted_yield",
  "phase_2_expected",
  "year5_distill",
  "sector_hhi",
  "mech_diversity",
  "operator_count",
];

/** 단일 자산·미연동 필드용 기본값으로 템플릿을 채웁니다. */
export function fillPortfolioPromptTemplate(vars: PortfolioPromptVars): string {
  let out = PORTFOLIO_PROMPT_TEMPLATE;
  for (const key of PLACEHOLDER_KEYS) {
    const val = vars[key] ?? "—";
    out = out.replaceAll(`{${key}}`, val);
  }
  return out.trim();
}

/** 야후 트레일링 분배율(비율 0~1) → 템플릿용 퍼센트 문자열 */
export function formatWeightedYieldFromTrailing(
  trailingYield: number | null | undefined,
): string {
  if (
    trailingYield === null ||
    trailingYield === undefined ||
    !Number.isFinite(trailingYield)
  ) {
    return "—";
  }
  return (trailingYield * 100).toFixed(2);
}
