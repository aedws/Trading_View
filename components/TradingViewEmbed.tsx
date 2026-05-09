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

export function toTradingViewSymbol(s: string): string {
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

/** TV 웹 URL은 보통 `EXCHANGE-TICKER`(하이픈) 경로를 씁니다. */
export function tradingViewWebPath(tvSymbol: string): string {
  return tvSymbol.replace(/^(.+):(.+)$/, "$1-$2");
}

export default function TradingViewEmbed({ symbol, height = 760 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    /** autosize만 쓰면 부모 너비가 0인 첫 프레임에 데모 심볼로 떨어지거나 높이가 붕괴됩니다. 픽셀 크기를 명시합니다. */
    function inject() {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      const tvSymbol = toTradingViewSymbol(symbol);
      const w = Math.max(
        280,
        Math.floor(el.getBoundingClientRect().width)
      );
      const h = Math.max(320, Math.floor(height));

      el.innerHTML = "";

      const widgetDiv = document.createElement("div");
      widgetDiv.className = "tradingview-widget-container__widget";
      widgetDiv.style.height = `${h}px`;
      widgetDiv.style.width = "100%";
      widgetDiv.style.minHeight = `${h}px`;
      el.appendChild(widgetDiv);

      const script = document.createElement("script");
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.async = true;
      script.type = "text/javascript";
      script.innerHTML = JSON.stringify({
        autosize: false,
        width: w,
        height: h,
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
      el.appendChild(script);
    }

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(inject);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      const elCleanup = containerRef.current;
      if (elCleanup) elCleanup.innerHTML = "";
    };
  }, [symbol, height]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-bg-card shrink-0">
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full isolate"
        style={{
          height,
          minHeight: height,
          width: "100%",
        }}
      />
      <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-border-soft flex items-center justify-between gap-2 flex-wrap">
        <span>
          <span className="text-gray-400">TV 심볼</span>{" "}
          <code className="text-accent-cyan num text-[10px]">
            {toTradingViewSymbol(symbol)}
          </code>
          <span className="text-gray-600 mx-1">·</span>
          인터벌·지표·드로잉은 차트 우상단에서.
        </span>
        <a
          href={`https://www.tradingview.com/symbols/${encodeURIComponent(
            tradingViewWebPath(toTradingViewSymbol(symbol))
          )}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:underline shrink-0"
        >
          TV에서 열기 ↗
        </a>
      </div>
    </div>
  );
}
