import { NextResponse } from "next/server";

import type { ReinvestMode } from "@/lib/coveredCall/dcaSim";
import { runCoveredCallAnalysis } from "@/lib/coveredCall/runAnalysis";
import { MAX_DURATION_COVERED_CALL } from "@/lib/vercelMaxDuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = MAX_DURATION_COVERED_CALL;

const MODES: ReinvestMode[] = [
  "no_reinvest",
  "self_reinvest",
  "distill_qqqi70_spyi30",
];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const ticker = String(body.ticker ?? "").trim();
    const start = String(body.start ?? "").trim();
    const end = String(body.end ?? "").trim();
    const periodAmount = Number(body.periodAmount ?? 500);
    const freq = String(body.freq ?? "W-FRI").trim();
    const primaryMode = String(body.primaryMode ?? "no_reinvest").trim();
    const benchmark =
      typeof body.benchmark === "string" && body.benchmark.trim()
        ? body.benchmark.trim()
        : "VOO";

    if (!ticker || !start || !end) {
      return NextResponse.json(
        { error: "ticker, start, end 가 필요합니다." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(periodAmount) || periodAmount <= 0) {
      return NextResponse.json({ error: "periodAmount는 양수여야 합니다." }, { status: 400 });
    }
    if (!MODES.includes(primaryMode as ReinvestMode)) {
      return NextResponse.json({ error: "primaryMode가 올바르지 않습니다." }, { status: 400 });
    }

    const result = await runCoveredCallAnalysis({
      ticker,
      start,
      end,
      periodAmount,
      freq,
      primaryMode: primaryMode as ReinvestMode,
      benchmark,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
