import Link from "next/link";

/**
 * EmailPane 본문 안에서 페이지 네비게이션을 "관련 메일 스레드"처럼 표시.
 * (`MainNav`의 위장 버전)
 */

const THREADS: { href: string; label: string }[] = [
  { href: "/", label: "지표 대시보드" },
  { href: "/backtest", label: "DCA 백테스트" },
  { href: "/covered-call", label: "커버드콜 분석" },
  { href: "/portfolio", label: "포트폴리오 분석" },
];

export default function RelatedThreads({
  active,
  className = "",
}: {
  active?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-[#3c4043] bg-[#1f1f1f] px-3 py-2.5 ${className}`}
    >
      <span className="text-[11px] text-gray-500 uppercase tracking-wider mr-1">
        관련 스레드
      </span>
      {THREADS.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`text-[12px] px-2.5 py-1 rounded-full border transition ${
              isActive
                ? "bg-[#8ab4f8]/20 border-[#8ab4f8]/40 text-[#8ab4f8]"
                : "bg-[#2d2e30] border-[#3c4043] text-gray-300 hover:bg-[#3c4043] hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
