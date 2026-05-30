"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Gmail 받은편지함 가운데 컬럼.
 * - `/api/market` 시세를 "수신 메일" 한 통씩으로 표시
 * - 클릭 → 전역 티커(sessionStorage + `ticker-selected` CustomEvent) 갱신
 * - 다른 페이지(/backtest 등)에 있을 경우 클릭 시 홈으로 이동
 * - 시세 외에 정적 더미 메일을 함께 표시해 받은편지함처럼 보이게 함
 */

const TICKER_STORAGE_KEY = "market-analyzer-ticker-v1";

export const TICKER_SELECTED_EVENT = "ticker-selected";

type MarketQuote = {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
};

/* ----- 정적 더미 메일들 (받은편지함을 가득 차 보이게) ----- */
const STATIC_EMAILS: {
  sender: string;
  initial: string;
  color: string;
  subject: string;
  preview: string;
  time: string;
}[] = [
  {
    sender: "Strategy Desk",
    initial: "WO",
    color: "from-[#a855f7] to-[#3b82f6]",
    subject: "주간 시황 전망 — 채권 금리 & FOMC 이후 자산군별 영향",
    preview: "10년물 4%대 진입 후 듀레이션·고배당주 비중...",
    time: "어제",
  },
  {
    sender: "Equity Research",
    initial: "EB",
    color: "from-[#34A853] to-[#06b6d4]",
    subject: "Q3 어닝 프리뷰 — 빅테크 7종 컨센서스 정리",
    preview: "GOOGL/MSFT/META 매출 가이던스, 마진 변동...",
    time: "어제",
  },
  {
    sender: "Macro Desk",
    initial: "FM",
    color: "from-[#FBBC04] to-[#EA4335]",
    subject: "FOMC 회의록 — 점도표 변경 가능성과 환율 영향",
    preview: "9월 회의록 분석. 25bp 추가 인하 시나리오 50%...",
    time: "2일 전",
  },
  {
    sender: "Digital Assets",
    initial: "CW",
    color: "from-[#3b82f6] to-[#a855f7]",
    subject: "Crypto Weekly — BTC ETF 자금 유입 가속",
    preview: "10월 누적 순유입 9.2B USD, ETH ETF 대기 자금...",
    time: "3일 전",
  },
  {
    sender: "Commodities",
    initial: "CM",
    color: "from-[#EA4335] to-[#FBBC04]",
    subject: "원자재 시장 — WTI 80달러 회복, 천연가스 정리",
    preview: "OPEC+ 감산 연장 가능성. 산업금속·농산물 동향...",
    time: "4일 전",
  },
  {
    sender: "Compliance",
    initial: "CO",
    color: "from-[#5f6368] to-[#3c4043]",
    subject: "[공지] 분기 자료 보안 점검 안내",
    preview: "내부 시스템 점검으로 일부 보고서 접근이 제한될...",
    time: "5일 전",
  },
];

function fmtPrice(value: number | null, currency: string | null, label: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (label === "달러 환율") return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  if (currency === "KRW") return Math.round(value).toLocaleString("ko-KR");
  if (currency === "USD") return value.toFixed(value >= 100 ? 2 : 3);
  return value.toFixed(2);
}

const GRADIENTS = [
  "from-[#1a73e8] to-[#ea4335]",
  "from-[#34A853] to-[#06b6d4]",
  "from-[#FBBC04] to-[#EA4335]",
  "from-[#a855f7] to-[#3b82f6]",
  "from-[#EA4335] to-[#FBBC04]",
  "from-[#34A853] to-[#1a73e8]",
  "from-[#06b6d4] to-[#a855f7]",
  "from-[#FBBC04] to-[#34A853]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickGradient(symbol: string): string {
  return GRADIENTS[hash(symbol) % GRADIENTS.length];
}

function getInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2);
}

/** 종목 라벨에 따라 그럴듯한 발신자 데스크 이름을 생성 */
function getSenderDesk(label: string, symbol: string): string {
  if (label.includes("코스피")) return "KOSPI 운영실";
  if (label.includes("코스닥")) return "KOSDAQ 데스크";
  if (label.includes("S&P") || label.includes("스앤피")) return "S&P 인덱스 데스크";
  if (label.includes("다우") || label.includes("Dow")) return "Dow 인덱스 데스크";
  if (label.includes("나스닥") || label.includes("Nasdaq")) return "Nasdaq 데스크";
  if (label.includes("닛케이")) return "Nikkei 데스크";
  if (label.includes("상해") || label.includes("항셍")) return "China 인덱스 데스크";
  if (label.includes("VIX") || label.includes("변동성")) return "VIX 변동성 데스크";
  if (label.includes("환율") || /=X$/.test(symbol)) return "외환·FX 데스크";
  if (label.includes("BTC") || symbol.startsWith("BTC")) return "디지털자산 데스크";
  if (label.includes("ETH") || symbol.startsWith("ETH")) return "디지털자산 데스크";
  if (label.includes("금") || label.includes("은") || label.includes("원유")) return "원자재 데스크";
  if (/\.KS$|\.KQ$/.test(symbol)) return "국내주식 리서치";
  return "글로벌 리서치";
}

/** 종목 심볼을 기반으로 결정적인 "수신 시각"을 생성 */
function getRecentTime(symbol: string): string {
  const times = [
    "방금",
    "1분 전",
    "3분 전",
    "5분 전",
    "8분 전",
    "12분 전",
    "20분 전",
    "30분 전",
    "오전 9:30",
    "오전 8:42",
  ];
  return times[hash(symbol) % times.length];
}

interface Props {
  /** GmailShell의 사이드바 접힘 상태와 동기화 (UI 강조에만 사용) */
  className?: string;
}

export default function InboxList({ className = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [tab, setTab] = useState<"all" | "important" | "unread">("all");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TICKER_STORAGE_KEY);
      if (raw) setSelectedSymbol(raw.replace(/\s+/g, "").toUpperCase());
    } catch {
      /* ignore */
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setSelectedSymbol(detail);
    };
    window.addEventListener(TICKER_SELECTED_EVENT, handler);
    return () => window.removeEventListener(TICKER_SELECTED_EVENT, handler);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
          setUpdatedAt(data.updatedAt ?? "");
        }
      } catch {
        /* keep last */
      }
    };
    load();
    timer = window.setInterval(load, 30000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const selectQuote = useCallback(
    (symbol: string) => {
      const normalized = symbol.replace(/\s+/g, "").toUpperCase();
      try {
        sessionStorage.setItem(TICKER_STORAGE_KEY, normalized);
      } catch {
        /* ignore */
      }
      setSelectedSymbol(normalized);
      window.dispatchEvent(
        new CustomEvent(TICKER_SELECTED_EVENT, { detail: normalized })
      );
      if (pathname !== "/") {
        router.push("/");
      }
    },
    [pathname, router]
  );

  return (
    <aside
      className={`hidden lg:flex w-[340px] xl:w-[380px] shrink-0 flex-col bg-bg border-r border-[#3c4043]/40 overflow-hidden ${className}`}
      aria-label="받은편지함"
    >
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#3c4043]/40 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-gray-100">받은편지함</h2>
          <span className="text-[11px] text-gray-500 tabular-nums">
            {quotes.length + STATIC_EMAILS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="필터">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
            </svg>
          </IconBtn>
          <IconBtn label="새로고침">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </IconBtn>
          <IconBtn label="더보기">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* 탭 */}
      <div className="px-4 flex gap-4 text-[12px] border-b border-[#3c4043]/40 shrink-0">
        {(
          [
            { key: "all", label: "전체" },
            { key: "important", label: "중요" },
            { key: "unread", label: "읽지 않음" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 -mb-px transition ${
              tab === t.key
                ? "text-gray-100 border-b-2 border-[#8ab4f8] font-medium"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {quotes.map((q, i) => {
          const initial = getInitial(q.label);
          const desk = getSenderDesk(q.label, q.symbol);
          const pct = q.changePercent ?? 0;
          const up = pct > 0;
          const down = pct < 0;
          const active =
            selectedSymbol != null &&
            q.symbol.replace(/\s+/g, "").toUpperCase() === selectedSymbol;
          const gradient = pickGradient(q.symbol);
          const time = i === 0 ? "방금" : getRecentTime(q.symbol);
          const priceTxt = fmtPrice(q.price, q.currency, q.label);
          const pctTxt =
            q.changePercent == null
              ? "—"
              : `${up ? "+" : ""}${q.changePercent.toFixed(2)}%`;

          return (
            <button
              key={q.symbol}
              type="button"
              onClick={() => selectQuote(q.symbol)}
              className={`group relative w-full text-left flex items-start gap-3 px-3 py-3 border-b border-[#3c4043]/30 transition ${
                active
                  ? "bg-[#1a3a52]/55"
                  : "hover:bg-[#2d2e30]/60"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8ab4f8]" />
              )}
              <span
                className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                  active ? "bg-[#8ab4f8]" : "bg-[#8ab4f8]/70"
                }`}
                aria-hidden
              />
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[11px] font-semibold shrink-0 select-none`}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-gray-100 truncate flex-1">
                    {desk}
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {time}
                  </span>
                </div>
                <div className="text-[13px] text-gray-100 truncate font-normal">
                  [시세] {q.label}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] text-gray-300 truncate flex-1 num">
                    {priceTxt}
                  </span>
                  <span
                    className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                      up
                        ? "bg-[#81c995]/15 text-[#81c995]"
                        : down
                          ? "bg-[#f28b82]/15 text-[#f28b82]"
                          : "bg-gray-500/15 text-gray-400"
                    }`}
                  >
                    {up ? "▲" : down ? "▼" : ""}
                    {q.changePercent == null
                      ? "—"
                      : `${Math.abs(q.changePercent).toFixed(2)}%`}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {/* 더미 메일들 (열람 처리: opacity 낮춤) */}
        {STATIC_EMAILS.map((email, i) => (
          <div
            key={`static-${i}`}
            className="w-full text-left flex items-start gap-3 px-3 py-3 border-b border-[#3c4043]/30 hover:bg-[#2d2e30]/40 cursor-default"
          >
            <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0 bg-transparent" />
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-br ${email.color} flex items-center justify-center text-white text-[11px] font-semibold shrink-0 select-none opacity-70`}
            >
              {email.initial}
            </div>
            <div className="flex-1 min-w-0 opacity-70">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-normal text-gray-300 truncate flex-1">
                  {email.sender}
                </span>
                <span className="text-[11px] text-gray-500 shrink-0">
                  {email.time}
                </span>
              </div>
              <div className="text-[13px] text-gray-300 truncate">
                {email.subject}
              </div>
              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                {email.preview}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div className="px-3 py-2 border-t border-[#3c4043]/40 text-[10px] text-gray-500 shrink-0 flex items-center justify-between">
        <span>받은편지함 동기화 · 30초마다</span>
        <span className="tabular-nums">
          {updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR") : "—"}
        </span>
      </div>
    </aside>
  );
}

function IconBtn({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#3c4043]/60 hover:text-gray-100 transition"
    >
      {children}
    </button>
  );
}
