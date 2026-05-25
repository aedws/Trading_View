"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base =
  "px-2.5 py-1 rounded-md text-[11px] font-medium transition whitespace-nowrap";
const inactive = `${base} text-gray-400 hover:text-gray-100 hover:bg-bg-card`;
const active = `${base} bg-accent-blue text-white`;

export default function MainNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const onDash = pathname === "/" || pathname === "";
  const onBt = pathname === "/backtest";
  const onCc = pathname === "/covered-call";
  const onPf = pathname === "/portfolio";
  return (
    <nav
      className={`flex items-center gap-1 rounded-lg border border-border bg-bg-soft p-0.5 shrink-0 ${className}`}
      aria-label="주요 페이지"
    >
      <Link href="/" className={onDash ? active : inactive}>
        지표 대시보드
      </Link>
      <Link href="/backtest" className={onBt ? active : inactive}>
        DCA 백테스트
      </Link>
      <Link href="/covered-call" className={onCc ? active : inactive}>
        커버드콜 분석
      </Link>
      <Link href="/portfolio" className={onPf ? active : inactive}>
        포트폴리오 분석
      </Link>
    </nav>
  );
}
