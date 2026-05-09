/**
 * Prefer `Number.isFinite`: global `isFinite(null)` is true (coerces to 0),
 * while JSON often turns `NaN` into `null`; `fmtNum(null)` must not call `.toFixed`.
 */
export function fmtPct(x: unknown, digits = 2): string {
  const n = coerceNumber(x);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(x: unknown, digits = 2): string {
  const n = coerceNumber(x);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtDate(d: string): string {
  if (!d || typeof d !== "string" || d.length < 2) return "—";
  return d.slice(2).replace(/-/g, ".");
}

export function fmtPrice(x: unknown, currency: string): string {
  const n = coerceNumber(x);
  if (!Number.isFinite(n)) return "—";
  const ccy = currency || "USD";
  if (ccy === "KRW") return `₩${Math.round(n).toLocaleString("ko-KR")}`;
  if (ccy === "USD") return `$${n.toFixed(n >= 100 ? 2 : 2)}`;
  return `${n.toFixed(2)} ${ccy}`;
}

/** Color a number: positive = green, negative = red, else gray. */
export function colorClass(x: unknown): string {
  const n = coerceNumber(x);
  if (!Number.isFinite(n) || n === 0) return "text-gray-300";
  return n > 0 ? "text-accent-green" : "text-accent-red";
}

function coerceNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (x == null) return NaN;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}
