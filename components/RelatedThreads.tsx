import Link from "next/link";

/**
 * EmailPane 본문 안에서 페이지 네비게이션을 "관련 메일 스레드"처럼 표시.
 * 각 페이지(스레드)는 메일의 발신팀 컬러와 카테고리 아이콘을 가집니다.
 */

interface Thread {
  href: string;
  label: string;
  subject: string;
  color: string;
  icon: React.ReactNode;
  unread?: number;
}

const THREADS: Thread[] = [
  {
    href: "/",
    label: "지표 대시보드",
    subject: "Daily Brief",
    color: "#1a73e8",
    unread: 1,
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
      </svg>
    ),
  },
  {
    href: "/backtest",
    label: "DCA 백테스트",
    subject: "Backtest Report",
    color: "#a855f7",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
      </svg>
    ),
  },
  {
    href: "/covered-call",
    label: "커버드콜 분석",
    subject: "Strategy",
    color: "#EA4335",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
      </svg>
    ),
  },
  {
    href: "/portfolio",
    label: "포트폴리오 분석",
    subject: "Portfolio",
    color: "#34A853",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z" />
      </svg>
    ),
  },
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
      className={`rounded-xl border border-[#3c4043]/70 bg-gradient-to-br from-[#1f1f1f] to-[#15172a] overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#3c4043]/50 bg-[#1f1f1f]/40">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-[#8ab4f8]"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z" />
          </svg>
          <span className="text-[10.5px] font-semibold text-gray-300 uppercase tracking-[0.14em]">
            관련 스레드
          </span>
          <span className="text-[10px] text-gray-500 tabular-nums">
            ({THREADS.length})
          </span>
        </div>
        <span className="text-[10px] text-gray-500 hidden sm:inline">
          같은 발신자 그룹 · 4개
        </span>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5 p-2.5">
        {THREADS.map((t) => {
          const isActive = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`group relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
                isActive
                  ? "border-transparent text-white shadow-md"
                  : "border-[#3c4043]/80 text-gray-300 hover:text-white bg-[#2d2e30]/60 hover:bg-[#3c4043]/70 hover:-translate-y-0.5"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: t.color,
                      boxShadow: `0 6px 16px -6px ${t.color}88, 0 0 0 1px ${t.color}55 inset`,
                    }
                  : undefined
              }
              title={`[${t.subject}] ${t.label}`}
            >
              <span
                className={`flex items-center justify-center w-4 h-4 rounded ${
                  isActive ? "" : ""
                }`}
                style={
                  isActive
                    ? { color: "white" }
                    : { color: t.color }
                }
                aria-hidden
              >
                {t.icon}
              </span>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider ${
                  isActive ? "text-white/90" : "text-gray-500"
                }`}
              >
                {t.subject}
              </span>
              <span className="text-[12px] font-semibold">{t.label}</span>
              {isActive && (
                <span className="ml-0.5 flex h-4 items-center justify-center rounded bg-white/20 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-white">
                  현재
                </span>
              )}
              {!isActive && t.unread && (
                <span
                  className="ml-0.5 flex h-4 items-center justify-center rounded-full px-1.5 text-[9.5px] font-semibold tabular-nums"
                  style={{
                    backgroundColor: `${t.color}22`,
                    color: t.color,
                  }}
                >
                  {t.unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
