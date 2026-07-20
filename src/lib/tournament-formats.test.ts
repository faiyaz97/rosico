import { describe, expect, it } from "vitest";

import {
  selectInitialTournamentFormat,
  tournamentFormatCapacity
} from "@/lib/tournament-formats";

const formats = [
  { id: "one", label: "1 vs 1", playersPerSide: 1 },
  { id: "two", label: "2 vs 2", playersPerSide: 2 },
  { id: "five", label: "5 vs 5", playersPerSide: 5 }
];

describe("tournament form formats", () => {
  it("calculates complete entries with an eight-entry limit", () => {
    expect(tournamentFormatCapacity(formats[0]!, 20)).toBe(8);
    expect(tournamentFormatCapacity(formats[1]!, 7)).toBe(3);
  });

  it("falls back when the requested format cannot make two entries", () => {
    expect(selectInitialTournamentFormat(formats, 8, "five")?.id).toBe("one");
  });

  it("returns no format when fewer than two entries are possible", () => {
    expect(selectInitialTournamentFormat([formats[2]!], 8)).toBeUndefined();
  });
});
