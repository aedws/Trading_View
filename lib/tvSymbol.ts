/** 야후 지수·매크로 티커 → TV 임베드에서 쓰이는 종목 문자열 */
const YAHOO_TO_TV: Record<string, string> = {
  "^IXIC": "NASDAQ:IXIC",
  "^GSPC": "SP:SPX",
  "^DJI": "DJ:DJI",
  "^VIX": "CBOE:VIX",
  "^KS11": "KRX:KOSPI",
  "^KQ11": "KRX:KOSDAQ",
  "DX-Y.NYB": "TVC:DXY",
  "KRW=X": "FX_IDC:USDKRW",
};

/** Yahoo·검색 티커를 TradingView advanced chart 심볼 문자열로 대략 매핑합니다. */
export function toTradingViewSymbol(s: string): string {
  const t = s.trim().toUpperCase();
  if (!t) return "NASDAQ:AAPL";
  if (t.includes(":")) return t;
  const mapped = YAHOO_TO_TV[t];
  if (mapped) return mapped;
  if (t.endsWith(".KS")) return `KRX:${t.replace(".KS", "")}`;
  if (t.endsWith(".KQ")) return `KOSDAQ:${t.replace(".KQ", "")}`;
  if (t.endsWith(".T")) return `TSE:${t.replace(".T", "")}`;
  if (t.endsWith(".HK")) return `HKEX:${t.replace(".HK", "")}`;
  if (t.endsWith(".L")) return `LSE:${t.replace(".L", "")}`;
  if (t === "BTC" || t === "BTC-USD") return "BINANCE:BTCUSDT";
  if (t === "ETH" || t === "ETH-USD") return "BINANCE:ETHUSDT";
  if (t.endsWith("=F")) return `CME:${t.replace("=F", "1!")}`;
  return t;
}

/** TV 웹 URL은 보통 `EXCHANGE-TICKER`(하이픈) 경로를 씁니다. */
export function tradingViewWebPath(tvSymbol: string): string {
  return tvSymbol.replace(/^(.+):(.+)$/, "$1-$2");
}
