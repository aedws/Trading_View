/**
 * Route Handler `export const maxDuration` values (seconds).
 *
 * Vercel documented limits (Node.js, pre–Fluid / classic serverless; see
 * https://vercel.com/docs/limits — “Vercel Functions” duration table):
 * - Hobby: default ~10s, configurable up to 60s
 * - Pro: default ~15s, configurable up to 300s
 *
 * Override per route in the Vercel dashboard (or `.env` for local):
 * - VERCEL_MAX_DURATION_ANALYZE (default 60) — /api/analyze
 * - VERCEL_MAX_DURATION_PRICES  (default 30) — /api/prices
 * - VERCEL_MAX_DURATION_MARKET (default 30) — /api/market
 * - VERCEL_MAX_DURATION_SEARCH (default 10) — /api/search
 * - VERCEL_MAX_DURATION_BACKTEST (default 60) — /api/backtest
 * - VERCEL_MAX_DURATION_COVERED_CALL (default 60) — /api/covered-call
 *
 * Values above the account plan maximum are clamped by Vercel at runtime.
 */
function envSeconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 900);
}

export const MAX_DURATION_ANALYZE = envSeconds(
  "VERCEL_MAX_DURATION_ANALYZE",
  60
);
export const MAX_DURATION_PRICES = envSeconds(
  "VERCEL_MAX_DURATION_PRICES",
  30
);
export const MAX_DURATION_MARKET = envSeconds(
  "VERCEL_MAX_DURATION_MARKET",
  30
);
export const MAX_DURATION_SEARCH = envSeconds(
  "VERCEL_MAX_DURATION_SEARCH",
  10
);

export const MAX_DURATION_BACKTEST = envSeconds(
  "VERCEL_MAX_DURATION_BACKTEST",
  60
);

/** 커버드콜 웹 분석 — 다중 야후 호출 */
export const MAX_DURATION_COVERED_CALL = envSeconds(
  "VERCEL_MAX_DURATION_COVERED_CALL",
  60
);
