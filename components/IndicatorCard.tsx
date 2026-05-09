"use client";

import { useState, type ReactNode } from "react";

export type Verdict = {
  /** Short label shown as a colored pill, e.g. "추세 강함" */
  label: string;
  /** "good" / "bad" / "neutral" — controls pill color */
  tone: "good" | "bad" | "neutral" | "warn";
  /** 1-2 sentences explaining the current reading */
  text: string;
};

type Props = {
  /** Card title shown at top */
  title: string;
  /** One-line subtitle, e.g. the family of indicator */
  subtitle?: string;
  /** Big primary value (already formatted) */
  big?: ReactNode;
  /** Smaller secondary numbers, label/value pairs */
  stats?: { label: string; value: ReactNode; tone?: "good" | "bad" | "neutral" }[];
  /** Verdict / interpretation bubble */
  verdict?: Verdict;
  /** Mini-chart / additional content area */
  children?: ReactNode;
  /** Math-explanation panel (formula, meaning, signals, caveats) */
  math: {
    formula: string;
    meaning: string;
    signals: string;
    caveats: string;
  };
  /** Width hint: "wide" → spans 2 cols on lg, default = 1 col */
  span?: "wide" | "normal";
};

const TONE_COLORS: Record<Verdict["tone"], string> = {
  good: "bg-accent-green/15 text-accent-green border-accent-green/30",
  bad: "bg-accent-red/15 text-accent-red border-accent-red/30",
  warn: "bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30",
  neutral: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

const STAT_TONE: Record<NonNullable<Props["stats"]>[number]["tone"] & string, string> = {
  good: "text-accent-green",
  bad: "text-accent-red",
  neutral: "text-gray-100",
};

export default function IndicatorCard({
  title,
  subtitle,
  big,
  stats,
  verdict,
  children,
  math,
  span = "normal",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border border-border bg-bg-card flex flex-col h-full min-h-0 ${
        span === "wide" ? "lg:col-span-2" : ""
      }`}
    >
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-gray-100">
            {title}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] px-2 py-1 rounded border border-border-soft text-gray-400 hover:text-gray-100 hover:border-accent-blue transition shrink-0"
          title="이 지표가 뭔지 자세히 보기"
        >
          수식·의미 {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="mx-4 mb-2 border border-border-soft rounded-lg bg-bg/50 p-3 text-xs space-y-2">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              수식
            </div>
            <div className="font-mono text-accent-cyan whitespace-pre-wrap">
              {math.formula}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              의미
            </div>
            <div className="text-gray-300 leading-relaxed">{math.meaning}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              매수·매도 신호
            </div>
            <div className="text-gray-300 leading-relaxed">{math.signals}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              주의
            </div>
            <div className="text-gray-400 leading-relaxed">{math.caveats}</div>
          </div>
        </div>
      )}

      <div className="px-4 pb-3 flex-1 flex flex-col gap-3 min-h-0">
        {(big || stats) && (
          <div className="flex items-end justify-between gap-3 flex-wrap">
            {big && (
              <div className="num text-2xl font-semibold leading-none">
                {big}
              </div>
            )}
            {stats && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                {stats.map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-gray-500">{s.label}</span>
                    <span
                      className={`num font-medium ${
                        STAT_TONE[s.tone ?? "neutral"]
                      }`}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {children}

        {verdict && (
          <div className="mt-auto pt-0.5">
            <div
              className={`text-xs leading-relaxed border rounded-lg px-3 py-2 ${
                TONE_COLORS[verdict.tone]
              }`}
            >
              <span className="font-semibold mr-2">{verdict.label}</span>
              <span className="text-gray-200">{verdict.text}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
