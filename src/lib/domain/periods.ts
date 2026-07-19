import {
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APPLICATION_TIME_ZONE = "Europe/Rome";

export type RankingPeriod = "all" | "year" | "quarter" | "month" | "week";
export type BoundedRankingPeriod = Exclude<RankingPeriod, "all">;

export type PeriodRange =
  | {
      start: null;
      end: null;
      period: "all";
      timeZone: typeof APPLICATION_TIME_ZONE;
    }
  | {
      start: Date;
      end: Date;
      period: BoundedRankingPeriod;
      timeZone: typeof APPLICATION_TIME_ZONE;
    };

export function getPeriodRange(
  period: "all",
  anchor: Date,
  timeZone?: typeof APPLICATION_TIME_ZONE
): Extract<PeriodRange, { period: "all" }>;
export function getPeriodRange(
  period: BoundedRankingPeriod,
  anchor: Date,
  timeZone?: typeof APPLICATION_TIME_ZONE
): Exclude<PeriodRange, { period: "all" }>;
export function getPeriodRange(
  period: RankingPeriod,
  anchor: Date,
  timeZone: typeof APPLICATION_TIME_ZONE = APPLICATION_TIME_ZONE
): PeriodRange {
  if (!Number.isFinite(anchor.getTime())) {
    throw new RangeError("The period anchor must be a valid date.");
  }
  if (period === "all") {
    return { start: null, end: null, period, timeZone };
  }

  const zonedAnchor = toZonedTime(anchor, timeZone);
  let localStart: Date;
  let localEnd: Date;

  switch (period) {
    case "year":
      localStart = startOfYear(zonedAnchor);
      localEnd = addYears(localStart, 1);
      break;
    case "quarter":
      localStart = startOfQuarter(zonedAnchor);
      localEnd = addQuarters(localStart, 1);
      break;
    case "month":
      localStart = startOfMonth(zonedAnchor);
      localEnd = addMonths(localStart, 1);
      break;
    case "week":
      localStart = startOfWeek(zonedAnchor, { weekStartsOn: 1 });
      localEnd = addWeeks(localStart, 1);
      break;
  }

  return {
    start: fromZonedTime(localStart, timeZone),
    end: fromZonedTime(localEnd, timeZone),
    period,
    timeZone
  } as Exclude<PeriodRange, { period: "all" }>;
}

export function isWithinPeriod(date: Date, range: PeriodRange): boolean {
  if (!Number.isFinite(date.getTime())) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date >= range.end) return false;
  return true;
}
