"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
};

export default function TickerInput({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: (ticker: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => setValue(initial), [initial]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function fetchSuggestions(q: string) {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.results ?? []))
      .catch(() => setSuggestions([]));
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    setOpen(true);
    setHighlight(0);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 200);
  }

  function pick(s: Suggestion) {
    const sym = (s.symbol ?? "").trim();
    if (!sym) return;
    setValue(sym);
    setOpen(false);
    onSubmit(sym);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && suggestions[highlight]) pick(suggestions[highlight]);
      else {
        setOpen(false);
        onSubmit(value.trim());
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-80">
      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => value && setOpen(true)}
        placeholder="티커 입력 (예: AAPL, 005930.KS, BTC-USD)"
        className="w-full px-3 py-2 bg-bg-soft border border-border rounded-lg text-sm focus:outline-none focus:border-accent-blue"
        autoComplete="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-bg-card border border-border rounded-lg shadow-xl max-h-72 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.symbol}-${i}`}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-soft ${
                i === highlight ? "bg-bg-soft" : ""
              }`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(s)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-accent-blue">{s.symbol}</span>
                <span className="text-[10px] text-gray-500">{s.exchange}</span>
              </div>
              <div className="text-xs text-gray-400 truncate">{s.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
