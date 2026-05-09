import type { CashFlow } from "./xirr";

export type ReinvestMode =
  | "no_reinvest"
  | "self_reinvest"
  | "distill_qqqi70_spyi30";

export const DISTILL_LEG1 = "QQQI";
export const DISTILL_LEG2 = "SPYI";
export const DISTILL_W1 = 0.7;
export const DISTILL_W2 = 0.3;

export type DayBar = {
  date: string;
  close: number;
  /** 주당 분할 배수(예 4:1 → 4). 없으면 1 */
  splitMult: number;
  dividendPerShare: number;
};

export type DcaResult = {
  wealth: number[];
  flows: CashFlow[];
  contributed: number;
  terminalWealth: number;
  dates: string[];
};

function applySplit(shares: number, mult: number): number {
  if (!Number.isFinite(mult) || mult <= 0 || mult === 1) return shares;
  return shares * mult;
}

export function simulateDca(
  bars: DayBar[],
  dcaDates: Set<string>,
  periodAmount: number,
  mode: ReinvestMode,
  /** distill 모드일 때 동일 길이 종가 시계열 */
  distillLegs?: { leg1: number[]; leg2: number[] },
): DcaResult {
  const dates = bars.map((b) => b.date);
  let shares = 0;
  let cash = 0;
  let shQ = 0;
  let shS = 0;
  let contributed = 0;
  const flows: CashFlow[] = [];
  const wealth: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const px = b.close;
    shares = applySplit(shares, b.splitMult);
    shQ = applySplit(shQ, 1);
    shS = applySplit(shS, 1);

    const divCash = b.dividendPerShare * shares;

    if (mode === "no_reinvest") {
      if (divCash > 1e-9) cash += divCash;
    } else if (mode === "self_reinvest") {
      if (divCash > 1e-9 && px > 0) shares += divCash / px;
    } else if (mode === "distill_qqqi70_spyi30") {
      const dq = distillLegs?.leg1[i];
      const ds = distillLegs?.leg2[i];
      if (divCash > 1e-9 && dq !== undefined && ds !== undefined && dq > 0 && ds > 0) {
        shQ += (divCash * DISTILL_W1) / dq;
        shS += (divCash * DISTILL_W2) / ds;
      }
    }

    if (dcaDates.has(b.date) && px > 0) {
      contributed += periodAmount;
      flows.push({ date: b.date, amount: -periodAmount });
      shares += periodAmount / px;
    }

    let legVal = 0;
    if (
      mode === "distill_qqqi70_spyi30" &&
      distillLegs !== undefined
    ) {
      legVal += shQ * distillLegs.leg1[i];
      legVal += shS * distillLegs.leg2[i];
    }
    const mv = shares * px + cash + legVal;
    wealth.push(mv);
  }

  const last = wealth.length ? wealth[wealth.length - 1] : 0;
  const lastDate = dates.length ? dates[dates.length - 1] : "";
  flows.push({ date: lastDate, amount: last });

  return {
    wealth,
    flows,
    contributed,
    terminalWealth: last,
    dates,
  };
}

export function simulateLumpSum(
  bars: DayBar[],
  totalIn: number,
  mode: ReinvestMode,
  distillLegs?: { leg1: number[]; leg2: number[] },
): DcaResult {
  if (bars.length === 0 || totalIn <= 0) {
    return { wealth: [], flows: [], contributed: 0, terminalWealth: 0, dates: [] };
  }
  const px0 = bars[0].close;
  const dates = bars.map((b) => b.date);
  const flows: CashFlow[] = [{ date: bars[0].date, amount: -totalIn }];
  let shares = totalIn / px0;
  let cash = 0;
  let shQ = 0;
  let shS = 0;
  const wealth: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const px = b.close;
    shares = applySplit(shares, b.splitMult);

    const divCash = b.dividendPerShare * shares;
    if (mode === "no_reinvest") {
      if (divCash > 1e-9) cash += divCash;
    } else if (mode === "self_reinvest") {
      if (divCash > 1e-9 && px > 0) shares += divCash / px;
    } else if (mode === "distill_qqqi70_spyi30") {
      const dq = distillLegs?.leg1[i];
      const ds = distillLegs?.leg2[i];
      if (divCash > 1e-9 && dq !== undefined && ds !== undefined && dq > 0 && ds > 0) {
        shQ += (divCash * DISTILL_W1) / dq;
        shS += (divCash * DISTILL_W2) / ds;
      }
    }

    let legVal = 0;
    if (mode === "distill_qqqi70_spyi30" && distillLegs) {
      legVal += shQ * distillLegs.leg1[i];
      legVal += shS * distillLegs.leg2[i];
    }
    wealth.push(shares * px + cash + legVal);
  }

  const last = wealth[wealth.length - 1];
  flows.push({ date: dates[dates.length - 1], amount: last });
  return {
    wealth,
    flows,
    contributed: totalIn,
    terminalWealth: last,
    dates,
  };
}
