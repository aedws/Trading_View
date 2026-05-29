import EmailPane from "@/components/EmailPane";
import RelatedThreads from "@/components/RelatedThreads";
import { BacktestForm } from "@/components/bt/BacktestForm";

export const metadata = {
  title: "[Backtest Report] DCA 적립식 매수 시뮬레이션 - Gmail",
  description:
    "적립식 매수 분할·금액/주 단위 IRR·전장 대비 분포 등 야후 일봉 기반 장기 시뮬레이션.",
};

export default function BacktestPage() {
  return (
    <EmailPane
      subject="[Backtest Report] DCA 적립식 매수 시뮬레이션 결과"
      senderName="Quant Strategy"
      senderEmail="quant@market-brief.com"
      senderInitial="QS"
      senderColor="from-[#a855f7] to-[#3b82f6]"
      date="오전 9:14"
      labels={[
        { label: "받은편지함" },
        { label: "Backtest", color: "#a855f7" },
        { label: "DCA", color: "#34A853" },
      ]}
      index={4}
      total={1247}
      metaNote={
        <span className="inline-flex items-center gap-1">
          <span>첨부 1개:</span>
          <span className="text-[#8ab4f8] underline-offset-2 hover:underline">
            dca-backtest-template.xlsx
          </span>
          <span className="text-gray-500">· 184 KB</span>
        </span>
      }
      signature={
        <div className="space-y-1">
          <p>감사합니다.</p>
          <p>
            <strong className="text-gray-200">Quantitative Strategy Team</strong>
            <br />
            Systematic Investing Desk
            <br />
            <span className="text-[#8ab4f8]">quant@market-brief.com</span>
          </p>
          <p className="text-[11px] text-gray-500 pt-2 max-w-2xl">
            ※ 본 도구는 교육·참고용이며 투자 권유가 아닙니다. 가격 지연·세금·
            수수료는 반영하지 않습니다.
          </p>
        </div>
      }
    >
      <p>안녕하세요, 고객님.</p>
      <p className="mt-2">
        요청하신 <strong className="text-gray-100">DCA(적립식 매수) 백테스트</strong>{" "}
        시뮬레이션 결과 양식을 회신드립니다. 기간·주기·금액(또는 고정 주 수)별
        적립 매수 결과를 IRR·매수처·매수 vs 보유 등으로 확인하실 수 있으며,
        커버드콜 ETF 분배·재투자 가정 분석 및 벤치마크 비교 옵션을 포함합니다.
      </p>

      <RelatedThreads active="/backtest" className="mt-5" />

      <div className="mt-4">
        <BacktestForm />
      </div>
    </EmailPane>
  );
}
