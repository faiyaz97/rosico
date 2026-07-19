import { describe, expect, it } from "vitest";

import { validateGameTeams } from "./game-validation";

const players = [
  { id: "p1", groupId: "g1", archivedAt: null },
  { id: "p2", groupId: "g1", archivedAt: null },
  { id: "p3", groupId: "g1", archivedAt: null },
  { id: "p4", groupId: "g1", archivedAt: null },
  { id: "old", groupId: "g1", archivedAt: new Date() },
  { id: "other", groupId: "g2", archivedAt: null }
];

describe("validateGameTeams", () => {
  it("accepts exact, unique, active same-group teams", () => {
    expect(() =>
      validateGameTeams({
        groupId: "g1",
        playersPerSide: 2,
        sideAPlayerIds: ["p1", "p2"],
        sideBPlayerIds: ["p3", "p4"],
        players
      })
    ).not.toThrow();
  });

  it("rejects wrong team sizes", () => {
    expect(() =>
      validateGameTeams({
        groupId: "g1",
        playersPerSide: 2,
        sideAPlayerIds: ["p1"],
        sideBPlayerIds: ["p3", "p4"],
        players
      })
    ).toThrow(/exactly 2/);
  });

  it("rejects a player on both sides", () => {
    expect(() =>
      validateGameTeams({
        groupId: "g1",
        playersPerSide: 1,
        sideAPlayerIds: ["p1"],
        sideBPlayerIds: ["p1"],
        players
      })
    ).toThrow(/only once/);
  });

  it("rejects archived and cross-group players", () => {
    expect(() =>
      validateGameTeams({
        groupId: "g1",
        playersPerSide: 1,
        sideAPlayerIds: ["p1"],
        sideBPlayerIds: ["old"],
        players
      })
    ).toThrow(/Archived/);
    expect(() =>
      validateGameTeams({
        groupId: "g1",
        playersPerSide: 1,
        sideAPlayerIds: ["p1"],
        sideBPlayerIds: ["other"],
        players
      })
    ).toThrow(/belong to this group/);
  });
});
