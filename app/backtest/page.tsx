import Link from "next/link";

import { BacktestForm } from "@/components/bt/BacktestForm";
import MainNav from "@/components/MainNav";

export const metadata = {
  title: "DCA 백테스트 — 시장분석기",
  description:
    "적립식 매수 분할·금액/주 단위 IRR·전장 대비 분포 등 야후 일봉 기반 장기 시뮬레이션.",
};

export default function BacktestPage() {
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
            자료 출처 Yahoo Finance · 교육·참고용
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DCA 백테스터</h1>
          <p className="mt-1 text-sm text-gray-400 max-w-2xl leading-relaxed">
            기간·주기·금액(또는 고정 주 수)별 적립 매수 결과를 IRR·매수처·매수 vs 보유 등으로
            봅니다. 커버드콜 ETF 분배·재투자 가정 분석 및 벤치마크 비교 옵션을 포함합니다.
          </p>
        </div>

        <BacktestForm />

        <footer className="pt-10 pb-16 border-t border-border text-[11px] text-gray-500 leading-relaxed">
          본 도구는 교육·참고용이며 투자 권유가 아닙니다. 가격 지연·세금·수수료는 반영하지
          않습니다.
        </footer>
      </div>
    </main>
  );
}
