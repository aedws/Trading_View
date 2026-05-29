"use client";

import { useState, type ReactNode } from "react";

/**
 * Gmail "열린 메일" 위장 패널.
 * 페이지의 실제 콘텐츠를 한 통의 메일처럼 보이게 감쌉니다.
 *   - 상단 액션 툴바 (보관/스팸/삭제/읽지않음/스누즈/라벨/더보기)
 *   - 제목 + 별표 + 라벨 칩
 *   - 발신자 카드 (아바타 + 이름 + 받는사람: 나 ▾ + 시각)
 *   - 본문 (children)
 *   - 답장/전체답장/전달 풋터 칩
 */

const I = {
  back: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
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
  unread: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z" />
    </svg>
  ),
  snooze: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  ),
  label: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  ),
  prev: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z" />
    </svg>
  ),
  starFilled: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  starOutline: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" />
    </svg>
  ),
  reply: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
    </svg>
  ),
  forward: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
    </svg>
  ),
  caret: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M7 10l5 5 5-5z" />
    </svg>
  ),
  important: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19 3H6c-.69 0-1.23.35-1.59.88L0 12l4.41 8.11c.36.53.9.89 1.59.89h13c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  ),
};

export interface EmailLabel {
  label: string;
  color?: string;
}

export interface EmailPaneProps {
  subject: string;
  senderName: string;
  senderEmail: string;
  /** 아바타 텍스트(없으면 senderName 첫 글자) */
  senderInitial?: string;
  /** Tailwind 그래디언트 클래스, e.g. "from-[#4285F4] to-[#34A853]" */
  senderColor?: string;
  /** 발송 시각 표시 텍스트, e.g. "오후 11:09 (3분 전)" */
  date?: string;
  labels?: EmailLabel[];
  /** 메일 본문 분리 표시: 상단 메타 행 아래 추가 메타(첨부, 공지 등) */
  metaNote?: ReactNode;
  /** 인덱스/총건수 */
  index?: number;
  total?: number;
  /** 답장 영역 표시 여부 (기본 true) */
  showFooter?: boolean;
  /** 메일 본문 아래에 추가 표시할 서명 영역 */
  signature?: ReactNode;
  children: ReactNode;
}

export default function EmailPane({
  subject,
  senderName,
  senderEmail,
  senderInitial,
  senderColor,
  date,
  labels = [],
  metaNote,
  index = 1,
  total = 1247,
  showFooter = true,
  signature,
  children,
}: EmailPaneProps) {
  const [starred, setStarred] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const initial =
    senderInitial ?? senderName.trim().slice(0, 1).toUpperCase() ?? "?";
  const gradient = senderColor ?? "from-[#4285F4] to-[#34A853]";

  return (
    <div className="flex flex-col min-h-full bg-bg">
      {/* ============ 상단 액션 툴바 ============ */}
      <div className="sticky top-0 z-10 flex items-center gap-0.5 px-3 h-12 bg-bg border-b border-[#3c4043]/40">
        <ToolBtn icon={I.back} label="받은편지함으로 돌아가기" />
        <ToolDivider />
        <ToolBtn icon={I.archive} label="보관" />
        <ToolBtn icon={I.spam} label="스팸 신고" />
        <ToolBtn icon={I.trash} label="삭제" />
        <ToolDivider />
        <ToolBtn icon={I.unread} label="읽지 않음으로 표시" />
        <ToolBtn icon={I.snooze} label="다시 알림" />
        <ToolBtn icon={I.label} label="라벨" />
        <ToolBtn icon={I.more} label="더보기" />

        <div className="ml-auto flex items-center gap-1 text-[12px] text-gray-400">
          <span className="tabular-nums mr-2">
            {index}/{total.toLocaleString()}
          </span>
          <ToolBtn icon={I.prev} label="이전" />
          <ToolBtn icon={I.next} label="다음" />
        </div>
      </div>

      {/* ============ 제목 행 ============ */}
      <div className="pt-6 pb-3 px-4 sm:px-12">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] sm:text-[22px] font-normal text-gray-100 leading-tight break-words">
              {subject}
            </h1>
            {labels.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {labels.map((l, i) => (
                  <span
                    key={`${l.label}-${i}`}
                    className="text-[11px] px-2 py-0.5 rounded font-medium border"
                    style={{
                      backgroundColor: l.color ? `${l.color}1f` : "#3c4043",
                      borderColor: l.color ? `${l.color}66` : "#5f6368",
                      color: l.color ?? "#e8eaed",
                    }}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setStarred((v) => !v)}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#3c4043]/60 transition"
            aria-label={starred ? "별표 제거" : "별표 표시"}
          >
            <span className={starred ? "text-[#fdd663]" : "text-gray-500"}>
              {starred ? I.starFilled : I.starOutline}
            </span>
          </button>
          <button
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#3c4043]/60 transition text-[#fdd663]"
            aria-label="중요 표시"
            title="이 대화는 중요합니다"
          >
            {I.important}
          </button>
        </div>
      </div>

      {/* ============ 발신자 카드 ============ */}
      <div className="px-4 sm:px-12 pb-3 flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none`}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[14px] flex-wrap">
            <span className="font-medium text-gray-100">{senderName}</span>
            <span className="text-gray-500 truncate">
              &lt;{senderEmail}&gt;
            </span>
          </div>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-0.5 text-[12px] text-gray-400 hover:text-gray-200 transition"
          >
            <span>받는사람: 나</span>
            <span
              className={`transition-transform ${
                showDetails ? "rotate-180" : ""
              }`}
            >
              {I.caret}
            </span>
          </button>
          {showDetails && (
            <div className="mt-2 text-[12px] text-gray-400 leading-relaxed space-y-0.5 max-w-xl">
              <DetailRow label="발신:" value={`${senderName} <${senderEmail}>`} />
              <DetailRow label="받는사람:" value="나 <user@gmail.com>" />
              <DetailRow label="날짜:" value={date ?? "오후 11:09"} />
              <DetailRow label="제목:" value={subject} />
              <DetailRow
                label="보안:"
                value={
                  <span className="inline-flex items-center gap-1 text-[#81c995]">
                    {I.shield}
                    <span>TLS · DKIM 인증 완료</span>
                  </span>
                }
              />
            </div>
          )}
          {metaNote && (
            <div className="mt-2 text-[12px] text-gray-400">{metaNote}</div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[12px] text-gray-400 mr-2 whitespace-nowrap hidden md:inline">
            {date ?? "오후 11:09"}
          </span>
          <ToolBtn icon={I.reply} label="답장" />
          <ToolBtn icon={I.more} label="더보기" />
        </div>
      </div>

      <div className="h-px bg-[#3c4043]/40 mx-4 sm:mx-12" />

      {/* ============ 본문 ============ */}
      <div className="flex-1 px-4 sm:px-12 pt-4 pb-2">
        <div className="sm:pl-[52px] text-[14px] text-gray-200 leading-relaxed">
          {children}
        </div>
      </div>

      {signature && (
        <div className="px-4 sm:px-12 pb-2">
          <div className="sm:pl-[52px] pt-4 border-t border-[#3c4043]/40 text-[13px] text-gray-400 leading-relaxed">
            {signature}
          </div>
        </div>
      )}

      {/* ============ 답장 풋터 ============ */}
      {showFooter && (
        <div className="px-4 sm:px-12 pt-4 pb-8">
          <div className="sm:pl-[52px] flex gap-2 flex-wrap">
            <PillBtn icon={I.reply} label="답장" />
            <PillBtn icon={I.reply} label="전체답장" flipped />
            <PillBtn icon={I.forward} label="전달" />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 hover:bg-[#3c4043]/60 transition"
    >
      {icon}
    </button>
  );
}

function ToolDivider() {
  return <span className="h-5 w-px bg-[#3c4043]/60 mx-1" />;
}

function PillBtn({
  icon,
  label,
  flipped,
}: {
  icon: ReactNode;
  label: string;
  flipped?: boolean;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3c4043] text-gray-200 hover:bg-[#3c4043]/40 transition text-[13px] font-medium"
    >
      <span className={flipped ? "inline-block scale-x-[-1]" : "inline-block"}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-14">{label}</span>
      <span className="text-gray-300 break-all">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------- */
/*  본문 내부에서 쓸 수 있는 보조 컴포넌트들                       */
/* -------------------------------------------------------------- */

/** 메일 본문에서 섹션 제목으로 쓰는 헤더 (번호 + 줄긋기) */
export function EmailSection({
  number,
  title,
  children,
}: {
  number: string | number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="flex items-baseline gap-2 pb-1 mb-3 border-b border-[#3c4043]/50">
        <span className="text-[12px] font-semibold text-[#8ab4f8] tabular-nums">
          {number}.
        </span>
        <h2 className="text-[15px] font-semibold text-gray-100 tracking-tight">
          {title}
        </h2>
      </div>
      {children && (
        <p className="text-[13px] text-gray-400 leading-relaxed mb-3">
          {children}
        </p>
      )}
    </div>
  );
}

/** 메일 본문에서 "첨부 파일" 박스 — 차트나 표를 묶을 때 */
export function EmailAttachment({
  filename,
  size,
  children,
}: {
  filename: string;
  size?: string;
  children: ReactNode;
}) {
  return (
    <div className="my-3 rounded-lg border border-[#3c4043] bg-[#1f1f1f]/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c4043]/60 text-[12px] text-gray-300">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#8ab4f8]" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
        </svg>
        <span className="font-medium">{filename}</span>
        {size && <span className="text-gray-500">· {size}</span>}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}
