import { describe, expect, it } from "vitest";

import { getPeriodRange } from "./periods";
import { calculateRankings, type RankingGame } from "./ranking";

const players = ["a", "b", "c", "d"].map((id) => ({
  id,
  displayName: id.toUpperCase()
}));

function game(
  id: string,
  sideAPlayerIds: string[],
  sideBPlayerIds: string[],
  outcome: RankingGame["outcome"],
  scoreA: number,
  scoreB: number,
  playedAt = new Date(`2026-07-${id.padStart(2, "0")}T12:00:00Z`),
  formatId = "1v1"
): RankingGame {
  return {
    id,
    sideAPlayerIds,
    sideBPlayerIds,
    outcome,
    comparableScoreA: scoreA,
    comparableScoreB: scoreB,
    playedAt,
    formatId
  };
}

describe("calculateRankings", () => {
  it("aggregates every player in a team game", () => {
    const rows = calculateRankings(players, [
      game("01", ["a", "b"], ["c", "d"], "A", 10, 7, undefined, "2v2")
    ]);
    expect(
      rows.map((row) => [row.playerId, row.gamesPlayed, row.wins])
    ).toEqual([
      ["a", 1, 1],
      ["b", 1, 1],
      ["c", 1, 0],
      ["d", 1, 0]
    ]);
    expect(rows.find((row) => row.playerId === "c")?.scoreDifference).toBe(-3);
  });

  it("ranks primarily by win percentage and then head-to-head", () => {
    const rows = calculateRankings(players, [
      game("01", ["a"], ["b"], "A", 5, 4),
      game("02", ["a"], ["c"], "B", 1, 10),
      game("03", ["b"], ["d"], "A", 5, 0)
    ]);
    expect(rows.findIndex((row) => row.playerId === "a")).toBeLessThan(
      rows.findIndex((row) => row.playerId === "b")
    );
    expect(rows.find((row) => row.playerId === "a")?.winPercentage).toBe(50);
    expect(rows.find((row) => row.playerId === "b")?.winPercentage).toBe(50);
  });

  it("continues through wins, score difference, games, and recent win", () => {
    const rows = calculateRankings(players, [
      game("01", ["a"], ["c"], "A", 5, 0),
      game("02", ["a"], ["d"], "B", 4, 5),
      game("03", ["b"], ["c"], "A", 10, 0),
      game("04", ["b"], ["d"], "B", 0, 5)
    ]);
    expect(rows.findIndex((row) => row.playerId === "b")).toBeLessThan(
      rows.findIndex((row) => row.playerId === "a")
    );
  });

  it("assigns shared competition positions for unresolved exact ties", () => {
    const rows = calculateRankings(players, [
      game("01", ["a"], ["c"], "A", 5, 0),
      game("01", ["b"], ["d"], "A", 5, 0)
    ]);
    expect(rows.map((row) => row.position)).toEqual([1, 1, 3, 3]);
  });

  it("can omit score difference when combining incompatible score scales", () => {
    const playedAt = new Date("2026-07-01T12:00:00Z");
    const rows = calculateRankings(
      players,
      [
        game("01", ["a"], ["c"], "A", 100, 0, playedAt),
        game("02", ["b"], ["d"], "A", 1, 0, playedAt)
      ],
      { useScoreDifferenceTieBreaker: false }
    );

    expect(rows.map((row) => row.position)).toEqual([1, 1, 3, 3]);
    expect(rows.find((row) => row.playerId === "a")?.scoreDifference).toBe(100);
    expect(rows.find((row) => row.playerId === "b")?.scoreDifference).toBe(1);
  });

  it("does not use RESULT canonical values as score totals or a margin tiebreaker", () => {
    const playedAt = new Date("2026-07-01T12:00:00Z");
    const rows = calculateRankings(players, [
      {
        ...game("01", ["a"], ["c"], "A", 1, 0, playedAt),
        scoreDifferenceEligible: false
      },
      {
        ...game("02", ["b"], ["d"], "A", 1, 0, playedAt),
        scoreDifferenceEligible: false
      }
    ]);

    expect(rows.map((row) => row.position)).toEqual([1, 1, 3, 3]);
    expect(rows.find((row) => row.playerId === "a")).toMatchObject({
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0
    });
  });

  it("filters by format and Rome-local time period", () => {
    const period = getPeriodRange("month", new Date("2026-07-17T12:00:00Z"));
    const rows = calculateRankings(
      players,
      [
        game("01", ["a"], ["b"], "A", 5, 0, new Date("2026-07-01T12:00:00Z")),
        game("02", ["b"], ["a"], "A", 5, 0, new Date("2026-06-15T12:00:00Z")),
        game(
          "03",
          ["c", "d"],
          ["a", "b"],
          "A",
          5,
          0,
          new Date("2026-07-03T12:00:00Z"),
          "2v2"
        )
      ],
      { formatId: "1v1", period }
    );
    expect(rows.map((row) => [row.playerId, row.wins])).toEqual([
      ["a", 1],
      ["b", 0]
    ]);
  });

  it("calculates the latest consecutive streak inside the filter", () => {
    const rows = calculateRankings(players, [
      game("01", ["a"], ["b"], "B", 0, 5),
      game("02", ["a"], ["b"], "A", 5, 0),
      game("03", ["a"], ["c"], "A", 5, 0)
    ]);
    expect(rows.find((row) => row.playerId === "a")?.currentStreak).toBe("W2");
  });
});
