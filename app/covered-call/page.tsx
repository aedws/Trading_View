import Link from "next/link";

import CoveredCallAnalyzer from "@/components/CoveredCallAnalyzer";
import MainNav from "@/components/MainNav";

export const metadata = {
  title: "커버드콜 분석 — 시장분석기",
  description:
    "야후 DCA·IRR·MDD·VOO 벤치·3종 재투자·원칙 기반 등급. 로컬 Python covered_call_dca/ 도 병행 가능.",
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
            야후 파이낸스 · 서버 /api/covered-call
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">커버드콜 분석</h1>
          <p className="mt-1 text-sm text-gray-400 max-w-3xl leading-relaxed">
            단일 티커에 대해 기간·적립·재투자 가정을 넣으면, 야후 일봉(분배·분할)로 DCA
            백테스트·XIRR·MDD·슬라이딩 분포·VOO 비교·증류( QQQI/SPYI ) 시나리오를 한 번에
            계산합니다. 등급과 원칙 체크는 메커니즘·변동성·갭·분배율 등 프록시 기반입니다.
          </p>
        </div>

        <CoveredCallAnalyzer />

        <section className="rounded-xl border border-border bg-bg-card p-4 text-[12px] text-gray-500 space-y-2">
          <p className="font-medium text-gray-400">CLI (로컬 검증·레퍼런스)</p>
          <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-bg-soft border border-border-soft text-gray-300">
            {`cd covered_call_dca
pip install -r requirements.txt
python validation_benchmarks.py`}
          </pre>
        </section>

        <footer className="pt-10 pb-16 border-t border-border text-[11px] text-gray-500 leading-relaxed">
          본 도구는 교육·참고용이며 투자 권유가 아닙니다.
        </footer>
      </div>
    </main>
  );
}
