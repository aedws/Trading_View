import EmailPane from "@/components/EmailPane";
import RelatedThreads from "@/components/RelatedThreads";
import PortfolioAnalyzer from "@/components/PortfolioAnalyzer";

export const metadata = {
  title: "[Portfolio] 자산 배분 및 위험 분해 - Gmail",
  description:
    "최대 10종목·가중치 합성으로 알파/베타/MDD/추적오차/상하방 캡처를 한 화면에 표시.",
};

export default function PortfolioPage() {
  return (
    <EmailPane
      subject="[Portfolio] 자산 배분 분석 및 위험 분해 — 분기 리뷰"
      senderName="Portfolio Solutions"
      senderEmail="portfolio@market-brief.com"
      senderInitial="PS"
      senderColor="from-[#34A853] to-[#06b6d4]"
      date="오후 2:08"
      labels={[
        { label: "받은편지함" },
        { label: "Portfolio", color: "#34A853" },
        { label: "Risk", color: "#EA4335" },
        { label: "분기리뷰", color: "#8ab4f8" },
      ]}
      index={12}
      total={1247}
      metaNote={
        <span className="inline-flex items-center gap-1">
          <span>첨부 1개:</span>
          <span className="text-[#8ab4f8] underline-offset-2 hover:underline">
            portfolio-risk-breakdown.xlsx
          </span>
          <span className="text-gray-500">· 312 KB</span>
        </span>
      }
      signature={
        <div className="space-y-1">
          <p>감사합니다.</p>
          <p>
            <strong className="text-gray-200">Portfolio Solutions Team</strong>
            <br />
            Asset Allocation &amp; Risk Analytics
            <br />
            <span className="text-[#8ab4f8]">portfolio@market-brief.com</span>
          </p>
          <p className="text-[11px] text-gray-500 pt-2 max-w-2xl">
            ※ 자료 출처: Yahoo Finance · 서버 /api/portfolio. 본 분석은 교육·
            참고용이며 어떠한 투자 권유도 아닙니다.
          </p>
        </div>
      }
    >
      <p>안녕하세요, 고객님.</p>
      <p className="mt-2">
        요청하신{" "}
        <strong className="text-gray-100">포트폴리오 위험 분해 리포트</strong>
        를 전달드립니다. 최대 10개 종목과 비중을 합성해 벤치마크 대비{" "}
        <strong className="text-gray-100">알파·베타·R²</strong>,{" "}
        <strong className="text-gray-100">추적오차·정보비율</strong>,{" "}
        <strong className="text-gray-100">상승/하락 캡처</strong>,{" "}
        <strong className="text-gray-100">MDD·회복일</strong>, 샤프·소르티노·
        VaR, 자산 간 상관행렬, 자산별 기여까지 한 번에 계산합니다.
      </p>

      <RelatedThreads active="/portfolio" className="mt-5" />

      <div className="mt-4">
        <PortfolioAnalyzer />
      </div>
    </EmailPane>
  );
}
