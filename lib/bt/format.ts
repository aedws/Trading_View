/** 백테스트 금액 표기용 통화 — 티커 접미사로 추론합니다. */
export type BacktestCcy = "KRW" | "USD";

export function tickerToBacktestCcy(ticker: string): BacktestCcy {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".KS") || t.endsWith(".KQ")) return "KRW";
  return "USD";
}

export function fmtMoney(
  x: number | null | undefined,
  currency: BacktestCcy = "USD",
  digits = 2,
): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (currency === "KRW") {
    return `${sign}₩${Math.round(abs).toLocaleString("ko-KR")}`;
  }
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtMoneyCompact(
  x: number | null | undefined,
  currency: BacktestCcy = "USD",
): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (currency === "KRW") {
    const a = Math.round(abs);
    if (a >= 100_000_000) return `${sign}₩${(a / 100_000_000).toFixed(2)}억`;
    if (a >= 10_000) return `${sign}₩${(a / 10_000).toFixed(1)}만`;
    return `${sign}₩${a.toLocaleString("ko-KR")}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNumber(
  x: number | null | undefined,
  digits = 4,
): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function classNames(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ");
}
