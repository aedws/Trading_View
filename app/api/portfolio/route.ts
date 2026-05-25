import { NextResponse } from "next/server";

import type { LegInput, RebalanceMode } from "@/lib/portfolio/composer";
import { runPortfolioAnalysis } from "@/lib/portfolio/runAnalysis";
import { MAX_DURATION_PORTFOLIO } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = MAX_DURATION_PORTFOLIO;

const ALLOWED_MODE = ["years", "inception", "custom"] as const;
const ALLOWED_REBAL = ["daily", "weekly", "monthly", "yearly"] as const;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawLegs = Array.isArray(body.legs) ? body.legs : [];
  const legs: LegInput[] = [];
  for (const item of rawLegs) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const t = String(rec.ticker ?? "").trim().toUpperCase();
    const w = Number(rec.weight);
    if (!t) continue;
    if (!Number.isFinite(w) || w <= 0) continue;

    let dividendDistribution: LegInput["dividendDistribution"];
    if (Array.isArray(rec.dividendDistribution)) {
      const arr: NonNullable<LegInput["dividendDistribution"]> = [];
      for (const d of rec.dividendDistribution) {
        if (!d || typeof d !== "object") continue;
        const dt = String((d as Record<string, unknown>).ticker ?? "")
          .trim()
          .toUpperCase();
        const dw = Number((d as Record<string, unknown>).weight);
        if (!dt) continue;
        if (!Number.isFinite(dw) || dw <= 0) continue;
        arr.push({ ticker: dt, weight: dw });
      }
      if (arr.length > 0) dividendDistribution = arr;
    }
    legs.push({ ticker: t, weight: w, dividendDistribution });
  }
  if (legs.length === 0) {
    return NextResponse.json(
      { error: "최소 1개 종목과 양수 가중치가 필요합니다." },
      { status: 400 },
    );
  }
  if (legs.length > 10) {
    return NextResponse.json(
      { error: "최대 10개 종목까지 합성할 수 있습니다." },
      { status: 400 },
    );
  }

  const benchmark =
    typeof body.benchmark === "string" && body.benchmark.trim()
      ? body.benchmark.trim().toUpperCase()
      : "VOO";

  const mode = String(body.mode ?? "years");
  if (!ALLOWED_MODE.includes(mode as (typeof ALLOWED_MODE)[number])) {
    return NextResponse.json(
      { error: `mode must be one of ${ALLOWED_MODE.join(", ")}` },
      { status: 400 },
    );
  }

  const years = Number(body.years);
  const start = typeof body.start === "string" ? body.start.trim() : undefined;
  const end = typeof body.end === "string" ? body.end.trim() : undefined;
  if (mode === "custom" && (!start || !end)) {
    return NextResponse.json(
      { error: "custom 모드는 start, end 가 필요합니다." },
      { status: 400 },
    );
  }

  const rebalanceRaw = String(body.rebalance ?? "daily");
  if (!ALLOWED_REBAL.includes(rebalanceRaw as RebalanceMode)) {
    return NextResponse.json(
      { error: `rebalance must be one of ${ALLOWED_REBAL.join(", ")}` },
      { status: 400 },
    );
  }
  const rebalance = rebalanceRaw as RebalanceMode;

  const riskFreeAnnual =
    typeof body.riskFreeAnnual === "number" && Number.isFinite(body.riskFreeAnnual)
      ? (body.riskFreeAnnual as number)
      : 0.045;

  try {
    const result = await runPortfolioAnalysis({
      legs,
      benchmark,
      mode: mode as (typeof ALLOWED_MODE)[number],
      years: Number.isFinite(years) && years > 0 ? years : undefined,
      start,
      end,
      rebalance,
      riskFreeAnnual,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
