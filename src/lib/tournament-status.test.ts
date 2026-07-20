import { describe, expect, it } from "vitest";

import {
  parseTournamentStatus,
  tournamentStatusOptions
} from "@/lib/tournament-status";

describe("tournament status filters", () => {
  it("accepts supported values and falls back to all", () => {
    expect(parseTournamentStatus("active")).toBe("active");
    expect(parseTournamentStatus(["draft", "completed"])).toBe("draft");
    expect(parseTournamentStatus("cancelled")).toBe("all");
    expect(parseTournamentStatus(undefined)).toBe("all");
  });

  it("builds shareable links without a redundant all query", () => {
    expect(tournamentStatusOptions("/tournaments")).toEqual([
      { label: "All", href: "/tournaments" },
      { label: "Active", href: "/tournaments?status=active" },
      { label: "Draft", href: "/tournaments?status=draft" },
      { label: "Completed", href: "/tournaments?status=completed" }
    ]);
  });
});
