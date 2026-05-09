/**
 * TradingView 무료 Advanced Chart 임베드는 거래소·심볼에 따라
 * "TradingView에서만 제공" 알림과 함께 차트가 비거나 데모 심볼로 떨어질 수 있습니다.
 *
 * 아래 심볼은 야후 대체 차트(YahooCloseChart · 15분 봉 우선, 없으면 일봉)로 통일합니다.
 */
import { MARKET_STRIP_USE_YAHOO_CHART_SYMBOLS } from "./marketStrip";

/** 무료 임베드에서 상대적으로 잘 열리는 원/달 야후 티커 — TV 쪽(FX_IDC:USDKRW) 사용 */
const TV_EMBED_USD_KRW_YAHOO = new Set(["KRW=X"]);

export function shouldUseYahooCloseChart(yahooTicker: string): boolean {
  const t = yahooTicker.trim().toUpperCase();
  if (MARKET_STRIP_USE_YAHOO_CHART_SYMBOLS.has(t)) return true;
  if (t.endsWith(".KS") || t.endsWith(".KQ")) return true;
  /** 그 외 FX(⋯=X)는 임베드가 막히는 경우가 많고, 원/달만 TV로 둡니다. */
  if (t.endsWith("=X") && !TV_EMBED_USD_KRW_YAHOO.has(t)) return true;
  return false;
}
