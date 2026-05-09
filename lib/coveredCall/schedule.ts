/** pandas 오프셋에 대응하는 적립일 — 거래일 캘린더에 스냅 */

function snapOnOrAfter(anchorIso: string, calendar: string[]): string | null {
  for (const d of calendar) {
    if (d >= anchorIso) return d;
  }
  return null;
}

function weeklyAnchors(
  startIso: string,
  endIso: string,
  weekday: number,
): string[] {
  const start = new Date(startIso + "T12:00:00Z");
  const end = new Date(endIso + "T12:00:00Z");
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getUTCDay() !== weekday && cur <= end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const mo = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const da = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${da}`);
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}

/**
 * @param freq W-FRI | W-WED | W-MON | ME (월말 거래일 근사)
 */
export function buildDcaDates(
  calendar: string[],
  start: string,
  end: string,
  freq: string,
): Set<string> {
  const result = new Set<string>();
  if (calendar.length === 0) return result;

  const cal = [...calendar].sort();
  const inRange = (d: string) => d >= start && d <= end;

  if (freq === "ME") {
    const byMonth = new Map<string, string[]>();
    for (const d of cal) {
      if (!inRange(d)) continue;
      const ym = d.slice(0, 7);
      const arr = byMonth.get(ym) ?? [];
      arr.push(d);
      byMonth.set(ym, arr);
    }
    for (const [, ds] of byMonth) {
      ds.sort();
      result.add(ds[ds.length - 1]);
    }
    return result;
  }

  const wd =
    freq === "W-MON" ? 1 : freq === "W-WED" ? 3 : freq === "W-FRI" ? 5 : 5;
  for (const anchor of weeklyAnchors(start, end, wd)) {
    const snapped = snapOnOrAfter(anchor, cal);
    if (snapped && inRange(snapped)) result.add(snapped);
  }
  return result;
}
