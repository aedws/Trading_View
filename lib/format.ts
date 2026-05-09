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
  const day = d.includes("T") ? d.slice(0, 10) : d;
  return day.slice(2).replace(/-/g, ".");
}

/** Yahoo 15분봉 등 ISO 시각 문자열용 — 서울 기준 날짜·시각 */
export function fmtChartIntradayAxis(iso: string): string {
  if (!iso || typeof iso !== "string") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtDate(iso);
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return fmtDate(iso);
  }
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
