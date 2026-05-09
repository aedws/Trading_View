"use client";

import { useEffect, useRef } from "react";

type Props = {
  /**
   * TradingView symbol. Use the same format as TradingView's chart URL:
   *   - US stocks: "NASDAQ:AAPL", "NYSE:JPM"
   *   - ETFs:      "AMEX:VOO"
   *   - Crypto:    "BINANCE:BTCUSDT"
   *   - KRX:       "KRX:005930"
   *
   * If a Yahoo-style symbol like "AAPL" or "005930.KS" is passed, the component
   * tries to coerce it into a TradingView symbol heuristically.
   */
  symbol: string;
  height?: number;
};

/** Best-effort conversion of common Yahoo tickers to TradingView symbols. */
function toTradingViewSymbol(s: string): string {
  const t = s.trim().toUpperCase();
  if (!t) return "NASDAQ:AAPL";
  if (t.includes(":")) return t;
  if (t.endsWith(".KS")) return `KRX:${t.replace(".KS", "")}`;
  if (t.endsWith(".KQ")) return `KOSDAQ:${t.replace(".KQ", "")}`;
  if (t.endsWith(".T")) return `TSE:${t.replace(".T", "")}`;
  if (t.endsWith(".HK")) return `HKEX:${t.replace(".HK", "")}`;
  if (t.endsWith(".L")) return `LSE:${t.replace(".L", "")}`;
  if (t === "BTC" || t === "BTC-USD") return "BINANCE:BTCUSDT";
  if (t === "ETH" || t === "ETH-USD") return "BINANCE:ETHUSDT";
  if (t.endsWith("=F")) return `CME:${t.replace("=F", "1!")}`;
  // default: assume US listing — TradingView handles unprefixed US symbols too
  return t;
}

export default function TradingViewEmbed({ symbol, height = 760 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const tvSymbol = toTradingViewSymbol(symbol);
    const container = containerRef.current;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "kr",
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      hotlist: false,
      calendar: false,
      studies: [
        "MASimple@tv-basicstudies",
        "BB@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies",
      ],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-bg-card">
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height, width: "100%" }}
      />
      <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-border-soft flex items-center justify-between">
        <span>
          TradingView 공식 위젯 — 인터벌·지표·드로잉 모두 우상단 도구막대에서.
        </span>
        <a
          href={`https://www.tradingview.com/symbols/${encodeURIComponent(
            toTradingViewSymbol(symbol)
          )}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:underline"
        >
          TV에서 열기 ↗
        </a>
      </div>
    </div>
  );
}
