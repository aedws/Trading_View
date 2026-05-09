# 시장분석기 — TradingView + 수학 지표 대시보드

같은 폴더의 `Back_Test`(DCA 백테스터)와 별도로 동작하는 **분석 전용** 웹앱입니다.
티커를 입력하면 한 화면에서:

1. **상단**: TradingView 공식 위젯 — 진짜 TradingView 차트, 인터벌·드로잉·내장 지표 100개+
2. **하단**: 우리가 직접 계산한 13개 카드의 수학 지표 대시보드

각 카드에는 우상단 **"수식·의미 ▼"** 버튼이 있어, 토글하면

- 사용한 수식 (LaTeX 비슷한 ASCII)
- 그 지표가 *진짜로* 뭘 측정하는지 (한국어)
- 매수·매도 신호로 어떻게 읽는지
- 어떤 가정·한계가 있어서 무엇을 조심해야 하는지

가 펼쳐집니다. **수학 모르더라도 이 카드만 읽으면 그 지표를 안전하게 사용할 수 있도록** 설계했습니다.

## 카드 구성 (4개 섹션 × 13개 카드)

### ① 통계 패키지 — 가격이 비싼지/싼지를 분포로 본다

| 카드 | 무엇 | 핵심 수식 |
|---|---|---|
| **로그-선형 회귀 채널** | 장기 추세 + ±1σ/±2σ 채널 + 추정 CAGR | `ln(P) = a + b·t + ε` |
| **60일 Z-score** | 최근 60일 평균 대비 몇 σ | `z = (P − μ_60) / σ_60` |
| **평균회귀 반감기** | 추세선까지 다시 돌아오는 데 걸리는 일수 | AR(1) `t_1/2 = −ln(2) / ln(φ)` |

### ② 장세 판별 — 추세 장인가, 박스 장인가

| 카드 | 무엇 | 핵심 수식 |
|---|---|---|
| **Hurst 지수 (R/S)** | H>0.5 추세, =0.5 랜덤, <0.5 평균회귀 | `ln(R/S) = c + H·ln(n)` |
| **ADX (14)** | Wilder 추세 강도 + 방향(+DI/−DI) | `ADX = RMA(DX, 14)` |
| **EWMA 변동성** | RiskMetrics 일별 변동성 + 4분위 비교 | `σ²_t = λσ²_{t−1} + (1−λ)r²` |
| **자기상관 ACF** | lag 1~20 + Ljung-Box Q | `ρ_k = Cov(r_t, r_{t−k}) / Var` |

### ③ 리스크 — 위험 1단위당 얼마나 벌고, 한 번에 얼마까지 잃는가

| 카드 | 무엇 |
|---|---|
| **리스크-조정 수익** | Sharpe / Sortino / Calmar + MDD + 회복일 + 낙폭 차트 |
| **VaR / CVaR** | 1일 95%/99% 역사적·정규 VaR, 그리고 Expected Shortfall |
| **꼬리위험** | 왜도·과잉첨도 + 일별 수익률 히스토그램 |

### ④ 주기 분석 — 시장의 리듬

| 카드 | 무엇 | 핵심 수식 |
|---|---|---|
| **FFT 파워 스펙트럼** | 가장 강한 주기 후보 Top 3 + 로그-주기 차트 | `X[k] = Σ x[n] e^{−2πikn/N}` |
| **Hilbert 변환** | 매시점 즉시 주기 + 진폭 엔벨로프 | `z(t) = x(t) + i·H[x](t)` |
| **Haar 웨이블릿** | 6개 시간 스케일별 에너지 비중 | `d_k = (s[2i] − s[2i+1])/√2` |

## 기술 스택

- **Frontend**: Next.js 14 (App Router) · TypeScript · Tailwind CSS
- **차트**: 외부 라이브러리 없이 SVG로 직접 그림 (가벼움)
- **데이터**: [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) — 인증 불필요
- **TradingView**: 공식 `embed-widget-advanced-chart.js` (무료, 가입 불필요)
- **수학**: 모두 순수 TypeScript, 외부 수치 라이브러리 없음. `lib/math/` 폴더 참조.

## 로컬 실행

```bash
cd 시장분석기
npm install
npm run dev
# http://localhost:3000
```

빌드 확인:

```bash
npm run build
npm start
```

## Vercel 배포 — API `maxDuration` (함수 시간 제한)

각 `app/api/**/route.ts`의 `maxDuration`(초)은 `lib/vercelMaxDuration.ts`에서 읽으며, 플랜·부하에 맞게 Vercel 대시보드 환경 변수로 덮어쓸 수 있습니다.

| 변수 | 기본값 | 해당 라우트 |
|------|--------|-------------|
| `VERCEL_MAX_DURATION_ANALYZE` | 60 | `GET /api/analyze` |
| `VERCEL_MAX_DURATION_PRICES` | 30 | `GET /api/prices` |
| `VERCEL_MAX_DURATION_MARKET` | 30 | `GET /api/market` |
| `VERCEL_MAX_DURATION_SEARCH` | 10 | `GET /api/search` |

플랜별로 Vercel이 허용하는 상한보다 크게 두면 플랫폼에서 잘립니다. (대략: Hobby 최대 약 60초·Pro 최대 수백 초 — [Limits](https://vercel.com/docs/limits) 문서 참고.)

## 폴더 구조

```
시장분석기/
  app/
    layout.tsx
    page.tsx                       # 메인 페이지 (TradingView + 대시보드)
    globals.css
    api/
      prices/route.ts              # GET /api/prices
      analyze/route.ts             # GET /api/analyze (모든 지표 한 번에)
      market/route.ts              # GET /api/market (상단 마켓 스트립)
      search/route.ts              # GET /api/search (티커 자동완성)
  components/
    Header.tsx
    TickerInput.tsx                # 자동완성 입력
    TradingViewEmbed.tsx           # TV 공식 위젯
    AnalysisDashboard.tsx          # 4개 섹션 조립
    IndicatorCard.tsx              # 공통 카드 + "수식·의미" 토글
    charts/
      Sparkline.tsx                # 라인+밴드+오버레이 SVG
      Bars.tsx                     # 바 차트 SVG
    cards/
      RegressionChannelCard.tsx
      ZScoreCard.tsx
      MeanReversionCard.tsx
      HurstCard.tsx
      AdxCard.tsx
      VolRegimeCard.tsx
      AutocorrCard.tsx
      RiskCard.tsx
      VarCard.tsx
      TailRiskCard.tsx
      FftCard.tsx
      HilbertCard.tsx
      WaveletCard.tsx
  lib/
    types.ts
    yahoo.ts                       # 가격/검색 fetch 래퍼
    analyze.ts                     # 모든 지표 계산 → AnalysisReport
    vercelMaxDuration.ts           # Vercel maxDuration 기본값 + env 오버라이드
    format.ts                      # 가격·% 포맷 헬퍼
    math/
      stats.ts                     # mean / std / quantile / skew / kurt / log-returns
      regression.ts                # OLS, 로그-선형 채널, AR(1) 반감기
      drawdown.ts                  # MDD, 낙폭 시리즈, 회복일
      autocorr.ts                  # ACF, Ljung-Box Q
      hurst.ts                     # R/S 분석
      adx.ts                       # Wilder ADX + DI
      vol.ts                       # EWMA 분산 + 변동성 레짐
      risk.ts                      # VaR, CVaR, Sharpe, Sortino, Calmar, 꼬리, Φ⁻¹
      fft.ts                       # Cooley-Tukey radix-2 + 파워 스펙트럼
      hilbert.ts                   # 해석 신호 → 진폭/즉시주기
      wavelet.ts                   # Haar 다단계 분해
```

## 사용한 티커 형식

야후 파이낸스 심볼 그대로:

- 미국: `AAPL`, `VOO`, `BRK-B`
- 한국: `005930.KS` (삼성전자, KOSPI), `069500.KS`, `035720.KQ` (KOSDAQ)
- 일본: `7203.T` (도요타)
- 홍콩: `0700.HK` (텐센트)
- 영국: `BARC.L`
- 암호화폐: `BTC-USD`, `ETH-USD`
- 선물: `ES=F`, `NQ=F`, `GC=F`

TradingView 위젯에는 자동으로 변환해서 넣습니다. 어떤 거래소에 있는지 안 맞으면 위젯 우상단의 검색으로 직접 바꿔주세요.

## 알아두면 좋은 것

- 모든 가격은 **adjusted close**(배당·분할 반영) 일별 종가입니다.
- 30일 미만 데이터로는 통계가 안정되지 않으므로 에러를 반환합니다 (`MAX` 또는 `10y`로 다시 시도).
- TradingView 위젯이 보여주는 가격은 **TradingView의 데이터**이고, 우리 카드의 가격은 **야후 파이낸스 데이터**라 미세하게 다를 수 있습니다 (장중·종가 시점 차이, 환율, 분할/배당 적용 시점 등).
- 전체 응답은 `/api/analyze`에서 5분 캐시됩니다 (`s-maxage=300`).
- 어떤 지표도 단독 신호로 매매하지 마세요 — 카드들의 각 "신호" 섹션에 *적합 조건*과 *주의*를 함께 적어두었습니다.

## 라이선스

학습/개인 사용 목적의 샘플입니다. 자유롭게 수정해 사용하세요.
