import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "시장분석기 — 수학 지표 대시보드",
  description:
    "TradingView 차트와 통계·장세·리스크·주기 분석 지표를 한 페이지에서. 각 지표의 수식·의미·신호·주의를 한국어로 해설합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
