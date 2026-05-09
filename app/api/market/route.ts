import { NextResponse } from "next/server";
import { fetchMarketQuotes } from "@/lib/yahoo";
import { MAX_DURATION_MARKET } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
/** 다종목 병렬 차트 호출 — 필요 시 env로 상한 조정. */
export const maxDuration = MAX_DURATION_MARKET;

const MARKET_SYMBOLS: Array<{ symbol: string; label: string }> = [
  { symbol: "^IXIC", label: "나스닥" },
  { symbol: "NQ=F", label: "나스닥100 선물" },
  { symbol: "^GSPC", label: "S&P500" },
  { symbol: "ES=F", label: "S&P500 선물" },
  { symbol: "RTY=F", label: "러셀2000 선물" },
  { symbol: "^DJI", label: "다우존스" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^KS11", label: "코스피" },
  { symbol: "^KQ11", label: "코스닥" },
  { symbol: "DX-Y.NYB", label: "달러 인덱스" },
  { symbol: "KRW=X", label: "달러 환율" },
];

export async function GET() {
  try {
    const quotes = await fetchMarketQuotes(MARKET_SYMBOLS);
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

