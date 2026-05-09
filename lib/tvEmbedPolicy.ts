/**
 * TradingView 무료 Advanced Chart 임베드는 거래소·심볼에 따라
 * "TradingView에서만 제공" 알림과 함께 차트가 비거나 데모 심볼로 떨어질 수 있습니다.
 * 한국 상장(.KS / .KQ)은 야후 일봉 기반 대체 차트를 쓰는 편이 안정적입니다.
 */
export function shouldUseYahooCloseChart(yahooTicker: string): boolean {
  const t = yahooTicker.trim().toUpperCase();
  return t.endsWith(".KS") || t.endsWith(".KQ");
}
