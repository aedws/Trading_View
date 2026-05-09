import { NextRequest, NextResponse } from "next/server";
import { fetchPriceSeries } from "@/lib/yahoo";
import type { RangeKey } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

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
    return NextResponse.json(series, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
