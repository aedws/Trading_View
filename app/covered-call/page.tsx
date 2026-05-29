import EmailPane from "@/components/EmailPane";
import RelatedThreads from "@/components/RelatedThreads";
import CoveredCallAnalyzer from "@/components/CoveredCallAnalyzer";

export const metadata = {
  title: "[Strategy] 커버드콜 ETF 시뮬레이션 - Gmail",
  description:
    "야후 DCA·IRR·MDD·벤치마크 비교·3종 재투자·원칙 기반 등급.",
};

export default function CoveredCallPage() {
  return (
    <EmailPane
      subject="[Strategy] 커버드콜 ETF 시뮬레이션 및 등급 평가 요청 건"
      senderName="Derivatives Desk"
      senderEmail="derivatives@market-brief.com"
      senderInitial="DD"
      senderColor="from-[#EA4335] to-[#FBBC04]"
      date="오전 10:32"
      labels={[
        { label: "받은편지함" },
        { label: "Options", color: "#EA4335" },
        { label: "Income", color: "#FBBC04" },
      ]}
      index={7}
      total={1247}
      metaNote={
        <span className="inline-flex items-center gap-1">
          <span>첨부 2개:</span>
          <span className="text-[#8ab4f8] underline-offset-2 hover:underline">
            covered-call-grading.pdf
          </span>
          <span className="text-gray-500">· 1.2 MB</span>
        </span>
      }
      signature={
        <div className="space-y-1">
          <p>감사합니다.</p>
          <p>
            <strong className="text-gray-200">Derivatives Strategy Desk</strong>
            <br />
            Options &amp; Yield Solutions
            <br />
            <span className="text-[#8ab4f8]">derivatives@market-brief.com</span>
          </p>
          <p className="text-[11px] text-gray-500 pt-2 max-w-2xl">
            ※ 등급·원칙 체크는 메커니즘·변동성·갭·분배율 등 프록시 기반이며
            확정적인 평가가 아닙니다. 교육·참고용 자료입니다.
          </p>
        </div>
      }
    >
      <p>안녕하세요, 고객님.</p>
      <p className="mt-2">
        문의주신{" "}
        <strong className="text-gray-100">커버드콜 ETF 단일 종목 분석</strong>{" "}
        결과를 회신드립니다. 단일 티커에 대해 기간·적립·재투자 가정을 넣으면,
        야후 일봉(분배·분할)로 DCA 백테스트·XIRR·MDD·슬라이딩 분포·VOO 비교·
        증류(QQQI/SPYI) 시나리오를 한 번에 계산합니다. 등급과 원칙 체크는
        메커니즘·변동성·갭·분배율 등 프록시 기반입니다.
      </p>

      <RelatedThreads active="/covered-call" className="mt-5" />

      <div className="mt-4">
        <CoveredCallAnalyzer />
      </div>
    </EmailPane>
  );
}
