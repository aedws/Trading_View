import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/yahoo";
import { MAX_DURATION_SEARCH } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
export const maxDuration = MAX_DURATION_SEARCH;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ results: [], hits: [] });
  const results = await searchTickers(q);
  const hits = results.map((r) => ({
    symbol: r.symbol,
    shortname: r.name,
    longname: r.name,
    exchange: r.exchange,
    exchDisp: r.exchange,
    quoteType: r.type,
    typeDisp: r.type,
  }));
  return NextResponse.json(
    { results, hits },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
