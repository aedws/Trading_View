import type { Metadata } from "next";
import "./globals.css";
import GmailShell from "@/components/GmailShell";

export const metadata: Metadata = {
  title: "받은편지함 (1,247) - user@gmail.com - Gmail",
  description:
    "Gmail은 무료로 안전한 이메일 환경을 제공합니다. 받은편지함을 정리하고 빠르게 검색하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg text-gray-100 antialiased">
        <GmailShell>{children}</GmailShell>
      </body>
    </html>
  );
}
