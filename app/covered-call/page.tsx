import Link from "next/link";

import MainNav from "@/components/MainNav";

export const metadata = {
  title: "커버드콜 분석 — 시장분석기",
  description:
    "yfinance 단일 자산 DCA·IRR·MDD·재투자 시나리오·등급·마크다운/AI 프롬프트 (Python CLI)",
};

export default function CoveredCallPage() {
  return (
    <main className="min-h-screen flex flex-col bg-bg text-gray-100">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight hover:opacity-90 shrink-0"
          >
            <span className="text-accent-blue">시장</span>분석기
          </Link>
          <MainNav />
          <div className="sm:ml-auto text-[11px] text-gray-500">
            Python 도구 경로 · <span className="font-mono">covered_call_dca/</span>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">커버드콜 분석</h1>
          <p className="mt-1 text-sm text-gray-400 max-w-3xl leading-relaxed">
            DCA 시뮬레이션, IRR/XIRR, MDD, lump-sum 및 VOO 벤치마크 비교, 분배 주기 추정,
            Sliding-window 분포, 재투자 3종, 등급(블랙리스트·룰), 마크다운 리포트·AI
            프롬프트는 저장소 루트의{" "}
            <code className="text-gray-200 font-mono text-[13px]">covered_call_dca/</code>{" "}
            패키지에서 실행합니다. 웹 UI 연동은 추후 확장합니다.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-bg-card p-4 space-y-3 text-sm text-gray-300">
          <h2 className="text-base font-medium text-gray-100">실행 예시</h2>
          <pre className="text-[12px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-bg-soft border border-border-soft text-gray-200">
            {`cd covered_call_dca
pip install -r requirements.txt
python main.py --ticker QDTE --start 2024-03-07 --end 2026-05-04 \\
  --output report.md --mode both
# 레퍼런스 케이스 (NVII·QDTE·GDXY·XOMO ±5%) 자동 검증
python validation_benchmarks.py`}
          </pre>
          <p className="text-[12px] text-gray-500">
            옵션: <span className="font-mono">--amount</span>,{" "}
            <span className="font-mono">--freq</span> (예: W-FRI),{" "}
            <span className="font-mono">--reinvest</span> no_reinvest | self_reinvest |
            distill_qqqi70_spyi30, <span className="font-mono">--mode</span> report |
            ai_prompt | both, <span className="font-mono">--no-benchmark</span>
          </p>
        </section>

        <footer className="pt-10 pb-16 border-t border-border text-[11px] text-gray-500 leading-relaxed">
          본 도구는 교육·참고용이며 투자 권유가 아닙니다.
        </footer>
      </div>
    </main>
  );
}
