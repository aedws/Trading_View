/**
 * 상단 마켓 스트립 (/api/market) 과 동일한 종목 목록.
 * 클릭 시 이 `symbol` 문자열이 곧 /api/analyze·차트 티커로 쓰입니다 (야후 형식).
 */
export const MARKET_STRIP_ITEMS: Array<{ symbol: string; label: string }> = [
  { symbol: "^IXIC", label: "나스닥" },
  { symbol: "NQ=F", label: "나스닥100 선물" },
  { symbol: "^GSPC", label: "S&P500" },
  { symbol: "ES=F", label: "S&P500 선물" },
  { symbol: "RTY=F", label: "러셀2000 선물" },
  { symbol: "^DJI", label: "다우존스" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^KS11", label: "코스피" },
  { symbol: "^KQ11", label: "코스닥" },
  { symbol: "DX-Y.NYB", label: "달러 인덱스" },
  { symbol: "KRW=X", label: "달러 환율" },
];

/**
 * 스트립 종목 중 TV 무료 임베드 대신 야후 차트를 쓸 야후 심볼.
 * `KRW=X`만 TV 임베드 유지 (`lib/tvEmbedPolicy`).
 */
export const MARKET_STRIP_USE_YAHOO_CHART_SYMBOLS = new Set(
  MARKET_STRIP_ITEMS.filter(
    (i) => i.symbol.trim().toUpperCase() !== "KRW=X"
  ).map((i) => i.symbol.trim().toUpperCase())
);
