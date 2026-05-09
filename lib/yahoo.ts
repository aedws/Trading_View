import YahooFinance from "yahoo-finance2";
import type { Bar, PriceSeries, RangeKey } from "./types";
import { RANGE_TO_DAYS } from "./types";

// Yahoo's chart endpoint aggressively rate-limits requests with the default
// Node `undici` user agent. Sending a real browser UA makes the requests
// look ordinary and is the documented workaround.
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  fetchOptions: {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  },
});

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MS_PER_DAY = 86_400_000;

export type MarketQuote = {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
};

export async function fetchPriceSeries(
  ticker: string,
  range: RangeKey
): Promise<PriceSeries> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) throw new Error("ticker is empty");

  const days = RANGE_TO_DAYS[range];
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - days * 24 * 60 * 60 * 1000);

  // Use chart() endpoint (more reliable than historical())
  const chart = await yahooFinance.chart(sym, {
    period1,
    period2,
    interval: "1d",
    includePrePost: false,
    events: "div|split",
  });

  const quotes = chart.quotes ?? [];
  const bars: Bar[] = quotes
    .filter(
      (q) =>
        q?.date != null &&
        q.open != null &&
        q.high != null &&
        q.low != null &&
        q.close != null
    )
    .map((q) => ({
      date: formatDate(new Date(q.date as Date)),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      adjClose: (q.adjclose ?? q.close) as number,
      volume: (q.volume ?? 0) as number,
    }));

  if (bars.length < 30) {
    throw new Error(
      `데이터가 너무 짧습니다 (${bars.length}일). 다른 티커나 기간을 시도해주세요.`
    );
  }

  const meta = chart.meta as
    | {
        currency?: string;
        exchangeName?: string;
        longName?: string;
        symbol?: string;
      }
    | undefined;

  // Korean stocks should always be displayed in KRW.
  const forceKrw = sym.endsWith(".KS") || sym.endsWith(".KQ");
  const normalizedCurrency = forceKrw ? "KRW" : meta?.currency ?? "USD";

  return {
    ticker: sym,
    currency: normalizedCurrency,
    longName: meta?.longName,
    exchange: meta?.exchangeName,
    bars,
  };
}

export async function fetchMarketQuotes(
  items: Array<{ symbol: string; label: string }>
): Promise<MarketQuote[]> {
  if (items.length === 0) return [];
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - 7 * MS_PER_DAY);

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const chart = await yahooFinance.chart(item.symbol, {
        period1,
        period2,
        interval: "1d",
      });
      return { item, chart };
    })
  );

  return results.map((result, idx) => {
    const item = items[idx];
    if (result.status !== "fulfilled") {
      return {
        symbol: item.symbol,
        label: item.label,
        price: null,
        change: null,
        changePercent: null,
        currency: null,
      };
    }
    const { chart } = result.value;
    const quotes = (chart.quotes ?? []).filter(
      (q) => typeof q?.close === "number" && Number.isFinite(q.close)
    ) as Array<{ close: number }>;
    const meta = chart.meta as
      | {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          currency?: string;
        }
      | undefined;

    const lastClose = quotes.length > 0 ? quotes[quotes.length - 1].close : null;
    const prevClose =
      typeof meta?.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta?.previousClose === "number"
        ? meta.previousClose
        : quotes.length >= 2
        ? quotes[quotes.length - 2].close
        : null;
    const price =
      typeof meta?.regularMarketPrice === "number"
        ? meta.regularMarketPrice
        : lastClose;
    const change =
      typeof price === "number" && typeof prevClose === "number"
        ? price - prevClose
        : null;
    const changePercent =
      typeof price === "number" &&
      typeof prevClose === "number" &&
      prevClose !== 0
        ? ((price - prevClose) / prevClose) * 100
        : null;

    return {
      symbol: item.symbol,
      label: item.label,
      price: typeof price === "number" ? price : null,
      change,
      changePercent,
      currency: meta?.currency ?? null,
    };
  });
}

export async function searchTickers(query: string): Promise<
  Array<{
    symbol: string;
    name: string;
    exchange?: string;
    type?: string;
  }>
> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });
    const quotes = (res.quotes ?? []) as Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      exchange?: string;
      quoteType?: string;
      isYahooFinance?: boolean;
    }>;
    return quotes
      .filter(
        (q) =>
          q.isYahooFinance &&
          typeof q.symbol === "string" &&
          q.symbol.trim().length > 0
      )
      .slice(0, 8)
      .map((q) => ({
        symbol: q.symbol!.trim(),
        name: q.longname ?? q.shortname ?? "",
        exchange: q.exchange,
        type: q.quoteType,
      }));
  } catch {
    return [];
  }
}
