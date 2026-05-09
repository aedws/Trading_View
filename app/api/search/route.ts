import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/yahoo";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ results: [] });
  const results = await searchTickers(q);
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
