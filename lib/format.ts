export function fmtPct(x: number, digits = 2): string {
  if (!isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number, digits = 2): string {
  if (!isFinite(x)) return "—";
  return x.toFixed(digits);
}

export function fmtDate(d: string): string {
  return d.slice(2).replace(/-/g, ".");
}

export function fmtPrice(x: number, currency: string): string {
  if (!isFinite(x)) return "—";
  if (currency === "KRW") return `₩${Math.round(x).toLocaleString("ko-KR")}`;
  if (currency === "USD") return `$${x.toFixed(x >= 100 ? 2 : 2)}`;
  return `${x.toFixed(2)} ${currency}`;
}

/** Color a number: positive = green, negative = red, else gray. */
export function colorClass(x: number): string {
  if (!isFinite(x) || x === 0) return "text-gray-300";
  return x > 0 ? "text-accent-green" : "text-accent-red";
}
