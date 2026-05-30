"use client";

import { useMemo } from "react";

/**
 * 메일 본문 안에 "주목받는 시장 뉴스" 헤드라인 리스트를 표시.
 * - 정적 풀에서 시드(보통 현재 티커) 기반으로 결정적 셔플
 * - 컬러 불릿 + 제목(링크 풍) + 출처 + 시각
 * - 시드가 바뀌면 표시되는 뉴스 세트가 자연스럽게 교체됨
 */

interface NewsItem {
  title: string;
  source: string;
  time: string;
  color: string;
}

const C = {
  red: "#EA4335",
  green: "#34A853",
  yellow: "#FBBC04",
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#ff9800",
  pink: "#f06292",
};

const NEWS_POOL: NewsItem[] = [
  {
    title: "엔비디아 시총 4조 달러 회복…AI 칩 수요 견조세 지속",
    source: "한국경제TV",
    time: "14:55",
    color: C.red,
  },
  {
    title: "삼성전자 3분기 영업이익 컨센서스 상회…메모리 회복 본격화",
    source: "연합인포맥스",
    time: "13:42",
    color: C.green,
  },
  {
    title: "FOMC 회의록 공개 임박…25bp 추가 인하 확률 75%로 상승",
    source: "Bloomberg",
    time: "12:18",
    color: C.yellow,
  },
  {
    title: "비트코인 ETF 누적 순유입 200억 달러 돌파…현물 비중 확대",
    source: "코인데스크 코리아",
    time: "11:30",
    color: C.purple,
  },
  {
    title: "테슬라 사이버트럭 분기 인도 사상 최대…전기차 침체 속 선전",
    source: "Reuters",
    time: "10:55",
    color: C.red,
  },
  {
    title: "TSMC 3나노 풀가동…애플·엔비디아 차세대 칩 수주 가속",
    source: "EE Times",
    time: "10:30",
    color: C.cyan,
  },
  {
    title: "유럽중앙은행, 추가 금리 인하 시사…유로존 인플레 둔화",
    source: "Financial Times",
    time: "09:58",
    color: C.blue,
  },
  {
    title: "원·달러 1,380원선 공방…수출업체 네고 물량 출회",
    source: "이데일리",
    time: "09:30",
    color: C.green,
  },
  {
    title: "현대차, 美 IRA 보조금 1.4조원 수령 확정…전동화 가속",
    source: "조선비즈",
    time: "09:12",
    color: C.yellow,
  },
  {
    title: "TIGER 미국S&P500 외인 순매수 5거래일 연속…ETF 자금 쏠림",
    source: "한국경제",
    time: "08:55",
    color: C.purple,
  },
  {
    title: "WTI 80달러 돌파…OPEC+ 자발적 감산 12월 연장 가능성",
    source: "OilPrice",
    time: "08:30",
    color: C.orange,
  },
  {
    title: "코스피, 외인·기관 동반 매수에 2,700선 회복 시도",
    source: "매일경제",
    time: "08:10",
    color: C.blue,
  },
  {
    title: "메타 Q3 광고 매출 컨센서스 상회…AI 추천 알고리즘 효과",
    source: "TechCrunch",
    time: "07:45",
    color: C.green,
  },
  {
    title: "마이크로소프트 Azure 매출 33% 성장…클라우드 AI 수요 호조",
    source: "CNBC",
    time: "07:20",
    color: C.cyan,
  },
  {
    title: "한국은행 금융통화위, 11월 동결 우세…미·일 통화정책 동향 주시",
    source: "연합뉴스",
    time: "06:58",
    color: C.yellow,
  },
  {
    title: "골드만삭스, 美 증시 12개월 목표가 상향…S&P500 6,400 전망",
    source: "MarketWatch",
    time: "06:42",
    color: C.red,
  },
  {
    title: "JP모건, AI 인프라 투자 사이클 2027년까지 지속 전망",
    source: "Bloomberg",
    time: "06:30",
    color: C.purple,
  },
  {
    title: "中 부동산 규제 완화…헝다·완다 채권 가격 하루새 8% 반등",
    source: "Caixin Global",
    time: "06:15",
    color: C.pink,
  },
  {
    title: "삼성SDI 美 GM 합작공장 가동…2026년 연 27GWh 양산 목표",
    source: "전자신문",
    time: "05:58",
    color: C.blue,
  },
  {
    title: "SK하이닉스 HBM3E 12단 양산 본격화…엔비디아 H200 공급 확정",
    source: "디지털타임스",
    time: "05:45",
    color: C.green,
  },
];

/** Mulberry32-풍 결정적 PRNG으로 시드 기반 셔플 */
function shuffleStable<T>(arr: T[], seed: string): T[] {
  const result = arr.slice();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  if (h === 0) h = 0x6d2b79f5;
  for (let i = result.length - 1; i > 0; i--) {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function NewsList({
  seed = "default",
  max = 10,
  className = "",
}: {
  seed?: string;
  max?: number;
  className?: string;
}) {
  const items = useMemo(
    () => shuffleStable(NEWS_POOL, seed).slice(0, max),
    [seed, max]
  );

  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((item, i) => (
        <li
          key={`${seed}-${i}`}
          className="news-item flex items-start gap-2.5 cursor-pointer"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <span
            className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-[13px] text-gray-200 group-hover:text-[#8ab4f8] hover:text-[#8ab4f8] hover:underline underline-offset-4 transition-colors leading-relaxed">
              {item.title}
            </span>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              — {item.source}
            </span>
            <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
              {item.time}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
