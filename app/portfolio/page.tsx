import Link from "next/link";

import MainNav from "@/components/MainNav";
import PortfolioAnalyzer from "@/components/PortfolioAnalyzer";

export const metadata = {
  title: "포트폴리오 분석 — 시장분석기",
  description:
    "최대 10종목·가중치 합성으로 알파/베타/MDD/추적오차/상하방 캡처를 한 화면에 표시.",
};

export default function PortfolioPage() {
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
            야후 파이낸스 · 서버 /api/portfolio
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">포트폴리오 분석</h1>
          <p className="mt-1 text-sm text-gray-400 max-w-3xl leading-relaxed">
            최대 10개 종목과 비중을 합성해 벤치마크 대비 <b>알파·베타·R²</b>,{" "}
            <b>추적오차·정보비율</b>, <b>상승/하락 캡처</b>, <b>MDD·회복일</b>,
            샤프·소르티노·VaR, 자산 간 상관행렬, 자산별 기여까지 한 번에 계산합니다.
          </p>
        </div>

        <PortfolioAnalyzer />

        <footer className="pt-10 pb-16 border-t border-border text-[11px] text-gray-500 leading-relaxed">
          야후 일봉 종가(배당·분할 반영) 기반. 알파·베타는 CAPM 회귀(무위험률 차감)이며,
          기간이 짧거나 거래일이 부족하면 일부 지표는 NaN으로 표시됩니다.
        </footer>
      </div>
    </main>
  );
}
