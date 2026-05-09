export type Bar = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};

export type PriceSeries = {
  ticker: string;
  currency: string;
  longName?: string;
  exchange?: string;
  bars: Bar[];
};

export type RangeKey = "1y" | "2y" | "3y" | "5y" | "10y" | "max";

export const RANGE_TO_DAYS: Record<RangeKey, number> = {
  "1y": 365,
  "2y": 365 * 2,
  "3y": 365 * 3,
  "5y": 365 * 5,
  "10y": 365 * 10,
  max: 365 * 60, // effectively all
};
