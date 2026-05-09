import { NextResponse } from "next/server";
import { MARKET_STRIP_ITEMS } from "@/lib/marketStrip";
import { fetchMarketQuotes } from "@/lib/yahoo";
import { MAX_DURATION_MARKET } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
/** 다종목 병렬 차트 호출 — 필요 시 env로 상한 조정. */
export const maxDuration = MAX_DURATION_MARKET;

export async function GET() {
  try {
    const quotes = await fetchMarketQuotes(MARKET_STRIP_ITEMS);
    return NextResponse.json(
      { quotes, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

