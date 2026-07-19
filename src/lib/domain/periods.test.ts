import { describe, expect, it } from "vitest";

import { getPeriodRange, isWithinPeriod } from "./periods";

describe("getPeriodRange", () => {
  it("uses half-open Rome-local month boundaries across DST", () => {
    const range = getPeriodRange("month", new Date("2026-03-29T12:00:00Z"));
    expect(range.start?.toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-03-31T22:00:00.000Z");
    expect(isWithinPeriod(new Date("2026-03-31T21:59:59.999Z"), range)).toBe(
      true
    );
    expect(isWithinPeriod(new Date("2026-03-31T22:00:00.000Z"), range)).toBe(
      false
    );
  });

  it("uses ISO Monday-to-Monday weeks", () => {
    const range = getPeriodRange("week", new Date("2026-07-17T12:00:00Z"));
    expect(range.start?.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-07-19T22:00:00.000Z");
  });

  it("uses predictable quarter boundaries", () => {
    const range = getPeriodRange("quarter", new Date("2026-07-17T12:00:00Z"));
    expect(range.start?.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("does not bound all-time results", () => {
    expect(getPeriodRange("all", new Date()).start).toBeNull();
    expect(getPeriodRange("all", new Date()).end).toBeNull();
  });
});
