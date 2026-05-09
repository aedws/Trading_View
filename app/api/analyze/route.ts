import { NextRequest, NextResponse } from "next/server";
import { fetchPriceSeries } from "@/lib/yahoo";
import { analyze } from "@/lib/analyze";
import type { RangeKey } from "@/lib/types";
import { MAX_DURATION_ANALYZE } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
/** Yahoo fetch + 전체 분석 연산 — Hobby 최대 60초까지 권장, Pro에서는 env로 더 올릴 수 있음. */
export const maxDuration = MAX_DURATION_ANALYZE;

const VALID_RANGES: RangeKey[] = ["1y", "2y", "3y", "5y", "10y", "max"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  const rangeRaw = (url.searchParams.get("range") ?? "5y") as RangeKey;
  const range: RangeKey = VALID_RANGES.includes(rangeRaw) ? rangeRaw : "5y";

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    const series = await fetchPriceSeries(ticker, range);
    const report = analyze(series);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
