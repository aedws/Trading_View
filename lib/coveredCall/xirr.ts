/** XIRR 근사 — scipy 없이 Brent 스타일 구간 탐색 */

export type CashFlow = { date: string; amount: number };

function xnpv(rate: number, flows: CashFlow[]): number {
  if (flows.length === 0) return 0;
  const t0 = new Date(flows[0].date + "T12:00:00Z").getTime();
  let s = 0;
  for (const f of flows) {
    const dt =
      (new Date(f.date + "T12:00:00Z").getTime() - t0) / (365.25 * 86400000);
    s += f.amount / Math.pow(1 + rate, dt);
  }
  return s;
}

export function computeXirr(flows: CashFlow[]): number {
  const sorted = [...flows].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 2) return NaN;
  const hasNeg = sorted.some((f) => f.amount < 0);
  const hasPos = sorted.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return NaN;

  const f = (r: number) => xnpv(r, sorted);

  for (let lo = -0.999; lo < 15; lo += 0.05) {
    for (let hi = lo + 0.01; hi <= lo + 8 && hi < 20; hi += 0.25) {
      try {
        const vlo = f(lo);
        const vhi = f(hi);
        if (!Number.isFinite(vlo) || !Number.isFinite(vhi)) continue;
        if (vlo === 0) return lo;
        if (vhi === 0) return hi;
        if (vlo * vhi < 0) {
          let a = lo;
          let b = hi;
          for (let i = 0; i < 80; i++) {
            const mid = (a + b) / 2;
            const vm = f(mid);
            if (!Number.isFinite(vm)) break;
            if (Math.abs(vm) < 1e-9) return mid;
            if (f(a) * vm <= 0) b = mid;
            else a = mid;
          }
          return (a + b) / 2;
        }
      } catch {
        continue;
      }
    }
  }
  return NaN;
}
