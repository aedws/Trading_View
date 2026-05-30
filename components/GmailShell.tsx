"use client";

import { useState, type ReactNode } from "react";

import InboxList from "./InboxList";

/**
 * Gmail(다크 모드 신버전) 위장 셸.
 * 3-컬럼 레이아웃: 좌측 폴더 사이드바 + 가운데 받은편지함 리스트 + 우측 열린 메일.
 */

type FolderKey =
  | "inbox"
  | "starred"
  | "snoozed"
  | "important"
  | "sent"
  | "drafts"
  | "scheduled"
  | "all"
  | "spam"
  | "trash";

interface Folder {
  key: FolderKey;
  label: string;
  icon: ReactNode;
  count?: number;
}

/* ---------- 아이콘들 (Material 스타일) ---------- */

const I = {
  menu: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  ),
  tune: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
  apps: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z" />
    </svg>
  ),
  starred: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" />
    </svg>
  ),
  snoozed: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  ),
  sent: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  drafts: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
    </svg>
  ),
  important: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19 3H6c-.69 0-1.23.35-1.59.88L0 12l4.41 8.11c.36.53.9.89 1.59.89h13c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  ),
  scheduled: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
    </svg>
  ),
  all: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M21 8v12.993A1 1 0 0120.007 22H3.993A.993.993 0 013 21.008V2.992C3 2.444 3.447 2 3.999 2H14l7 6zm-2 1h-6V4H5v16h14V9zM8 7h3v2H8V7zm0 4h8v2H8v-2zm0 4h8v2H8v-2z" />
    </svg>
  ),
  spam: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
};

/* ---------- Gmail 로고 ---------- */

function GmailLogo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg width="36" height="28" viewBox="0 0 109 78" aria-hidden>
        <path
          d="M0 18.5v50A9.5 9.5 0 009.5 78H25V37.31L0 18.5z"
          fill="#4285F4"
        />
        <path
          d="M84 78h15.5A9.5 9.5 0 00109 68.5v-50L84 37.31V78z"
          fill="#34A853"
        />
        <path
          d="M84 18.5L54.5 41 25 18.5V78h59V18.5z"
          fill="#EA4335"
        />
        <path
          d="M109 13.5C109 8.81 105.19 5 100.5 5c-2.04 0-3.93.7-5.43 1.88L84 14.5l-29.5 22L25 14.5 14.43 6.88A8.467 8.467 0 008.5 5C3.81 5 0 8.81 0 13.5v5L25 37.31 54.5 59 84 37.31 109 18.5v-5z"
          fill="#C5221F"
        />
        <path
          d="M0 13.5v5L25 37.31 54.5 59 84 37.31 109 18.5v-5C109 8.81 105.19 5 100.5 5L54.5 38.5 8.5 5C3.81 5 0 8.81 0 13.5z"
          fill="#FBBC04"
        />
      </svg>
      <span
        className="text-[22px] font-normal text-gray-300 tracking-tight"
        style={{
          fontFamily:
            '"Product Sans", "Google Sans", "Roboto", system-ui, sans-serif',
        }}
      >
        Gmail
      </span>
    </div>
  );
}

/* ---------- 폴더 정의 ---------- */

const FOLDERS: Folder[] = [
  { key: "inbox", label: "받은편지함", icon: I.inbox, count: 1247 },
  { key: "starred", label: "별표편지함", icon: I.starred },
  { key: "snoozed", label: "다시 알림", icon: I.snoozed },
  { key: "important", label: "중요편지함", icon: I.important },
  { key: "sent", label: "보낸편지함", icon: I.sent },
  { key: "drafts", label: "임시보관함", icon: I.drafts, count: 12 },
  { key: "scheduled", label: "예약됨", icon: I.scheduled },
  { key: "all", label: "전체보관함", icon: I.all },
  { key: "spam", label: "스팸함", icon: I.spam, count: 28 },
  { key: "trash", label: "휴지통", icon: I.trash },
];

/* ---------- 셸 본체 ---------- */

export default function GmailShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<FolderKey>("inbox");

  const sidebarWidth = collapsed ? "w-[68px]" : "w-[256px]";

  return (
    <div className="flex h-screen flex-col bg-[#1f1f1f] text-gray-300 overflow-hidden">
      {/* ============ 상단바 ============ */}
      <header className="flex h-16 items-center gap-2 px-2 sm:px-4 shrink-0">
        <button
          aria-label="기본 메뉴"
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-300 hover:bg-[#3c4043]/60"
        >
          {I.menu}
        </button>

        <div className="hidden sm:block">
          <GmailLogo />
        </div>

        {/* 검색 바 */}
        <div className="flex-1 mx-2 sm:mx-6 max-w-[720px]">
          <label className="flex h-12 items-center gap-3 rounded-full bg-[#2d2e30] px-4 transition focus-within:bg-[#1f1f1f] focus-within:shadow-[0_1px_2px_0_rgba(0,0,0,0.6)] focus-within:ring-1 focus-within:ring-[#8ab4f8]">
            <button
              type="button"
              aria-label="검색"
              className="text-gray-400 hover:text-gray-200"
            >
              {I.search}
            </button>
            <input
              type="text"
              placeholder="메일 검색"
              className="flex-1 bg-transparent text-[15px] text-gray-200 placeholder:text-gray-400 outline-none"
            />
            <button
              type="button"
              aria-label="검색 옵션 표시"
              className="rounded-full p-1 text-gray-400 hover:bg-[#3c4043] hover:text-gray-200"
            >
              {I.tune}
            </button>
          </label>
        </div>

        {/* 오른쪽 액션 */}
        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="지원"
            className="hidden md:flex h-10 w-10 items-center justify-center rounded-full text-gray-300 hover:bg-[#3c4043]/60"
          >
            {I.help}
          </button>
          <button
            aria-label="설정"
            className="hidden md:flex h-10 w-10 items-center justify-center rounded-full text-gray-300 hover:bg-[#3c4043]/60"
          >
            {I.settings}
          </button>
          <button
            aria-label="Google 앱"
            className="hidden md:flex h-10 w-10 items-center justify-center rounded-full text-gray-300 hover:bg-[#3c4043]/60"
          >
            {I.apps}
          </button>
          <button
            aria-label="Google 계정"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4] to-[#34A853] text-sm font-medium text-white"
          >
            U
          </button>
        </div>
      </header>

      {/* ============ 본문 영역 (사이드바 + 메일 패널) ============ */}
      <div className="flex flex-1 min-h-0">
        {/* ---- 사이드바 ---- */}
        <aside
          className={`${sidebarWidth} shrink-0 flex flex-col py-2 transition-[width] duration-200 ease-out`}
        >
          {/* 편지쓰기 */}
          <div className={`px-2 ${collapsed ? "" : "pr-4"} mb-3`}>
            <button
              className={`flex items-center gap-3 h-14 rounded-2xl bg-[#3c4043] text-gray-100 shadow-sm hover:shadow-md hover:bg-[#41444a] transition ${
                collapsed ? "w-14 justify-center" : "w-full px-4"
              }`}
            >
              <span className="text-[#a8c7fa]">{I.pencil}</span>
              {!collapsed && (
                <span className="text-[14px] font-medium">편지쓰기</span>
              )}
            </button>
          </div>

          {/* 폴더 리스트 */}
          <nav className="flex-1 overflow-y-auto pr-2">
            {FOLDERS.map((f) => {
              const active = selected === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSelected(f.key)}
                  className={`group flex items-center h-8 ${
                    collapsed ? "mx-2 w-12 justify-center rounded-full" : "w-full pl-6 pr-4 rounded-r-full"
                  } ${
                    active
                      ? "bg-[#d3e3fd] text-[#001d35]"
                      : "text-gray-300 hover:bg-[#3c4043]/60"
                  }`}
                  title={f.label}
                >
                  <span className={`shrink-0 ${active ? "text-[#001d35]" : ""}`}>
                    {f.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span
                        className={`ml-4 truncate text-[14px] ${
                          active ? "font-semibold" : "font-normal"
                        }`}
                      >
                        {f.label}
                      </span>
                      {typeof f.count === "number" && (
                        <span
                          className={`ml-auto text-[12px] tabular-nums ${
                            active ? "text-[#001d35] font-semibold" : "text-gray-400"
                          }`}
                        >
                          {f.count.toLocaleString()}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}

            {!collapsed && (
              <button className="mt-1 flex w-full items-center gap-4 pl-6 pr-4 h-8 rounded-r-full text-gray-300 hover:bg-[#3c4043]/60">
                <span>{I.chevron}</span>
                <span className="text-[14px]">더보기</span>
              </button>
            )}
          </nav>

          {/* 라벨 섹션 (미니멀) */}
          {!collapsed && (
            <div className="mt-4 pr-2">
              <div className="flex items-center justify-between pl-6 pr-3 h-9 text-[11px] uppercase tracking-wider text-gray-400">
                <span>라벨</span>
                <button
                  aria-label="새 라벨"
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#3c4043]/60"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ---- 받은편지함 리스트 (가운데 컬럼) ---- */}
        <InboxList />

        {/* ---- 메인(메일 본문) 패널 ---- */}
        <main className="flex-1 min-w-0 m-2 ml-0 rounded-2xl bg-bg border border-[#3c4043]/60 overflow-auto shadow-inner">
          {children}
        </main>
      </div>
    </div>
  );
}
