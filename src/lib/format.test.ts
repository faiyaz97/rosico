import { describe, expect, it } from "vitest";

import { formatPercentage } from "./format";

describe("formatPercentage", () => {
  it("shows at most two decimal places without unnecessary zeros", () => {
    expect(formatPercentage(66.6666666667)).toBe("66.67");
    expect(formatPercentage(50)).toBe("50");
    expect(formatPercentage(33.3)).toBe("33.3");
  });
});
