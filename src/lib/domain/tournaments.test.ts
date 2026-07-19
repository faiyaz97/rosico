import { describe, expect, it } from "vitest";

import {
  advanceBracketWinner,
  applySeriesLeg,
  calculateLeagueStandings,
  generateRoundRobinFixtures,
  generateSingleEliminationBracket,
  requiredWins,
  tournamentCompletionDate
} from "./tournaments";

describe("tournament dates", () => {
  it("never completes a tournament before its scheduled start", () => {
    const startsAt = new Date("2026-08-01T12:00:00Z");
    expect(
      tournamentCompletionDate(startsAt, new Date("2026-07-19T12:00:00Z"))
    ).toEqual(startsAt);
    expect(
      tournamentCompletionDate(startsAt, new Date("2026-08-02T12:00:00Z"))
    ).toEqual(new Date("2026-08-02T12:00:00Z"));
  });
});

describe("elimination tournaments", () => {
  it("validates best-of and returns required wins", () => {
    expect(requiredWins(1)).toBe(1);
    expect(requiredWins(7)).toBe(4);
    expect(() => requiredWins(2)).toThrow(/positive odd/);
    expect(() => requiredWins(101)).toThrow(/no greater than 99/);
  });

  it("creates a full bracket and advances three byes for five entries", () => {
    const bracket = generateSingleEliminationBracket(
      ["a", "b", "c", "d", "e"].map((id, index) => ({
        id,
        seed: index + 1
      }))
    );
    expect(bracket).toHaveLength(7);
    const firstRound = bracket.filter((match) => match.round === 1);
    expect(firstRound.filter((match) => match.winnerEntryId)).toHaveLength(3);
    expect(firstRound.filter((match) => match.status === "READY")).toHaveLength(
      1
    );
    expect(bracket.find((match) => match.id === "r2-m1")).toMatchObject({
      sideAEntryId: "a",
      sideBEntryId: "b",
      status: "READY"
    });
  });

  it("does not count drawn legs toward a best-of series", () => {
    const draw = applySeriesLeg(
      { sideAWins: 0, sideBWins: 0, bestOf: 3, winnerEntryId: null },
      "DRAW",
      "a",
      "b"
    );
    expect(draw).toEqual({
      sideAWins: 0,
      sideBWins: 0,
      winnerEntryId: null,
      completed: false
    });
    const final = applySeriesLeg(
      { sideAWins: 1, sideBWins: 1, bestOf: 3, winnerEntryId: null },
      "B",
      "a",
      "b"
    );
    expect(final).toMatchObject({
      sideBWins: 2,
      winnerEntryId: "b",
      completed: true
    });
  });

  it("advances a winner into the correct downstream side", () => {
    const bracket = generateSingleEliminationBracket(
      ["a", "b", "c", "d"].map((id, index) => ({ id, seed: index + 1 }))
    );
    const afterFirst = advanceBracketWinner(bracket, "r1-m1", "a");
    expect(afterFirst.find((match) => match.id === "r2-m1")).toMatchObject({
      sideAEntryId: "a",
      sideBEntryId: null,
      status: "PENDING"
    });
    const afterSecond = advanceBracketWinner(afterFirst, "r1-m2", "c");
    expect(afterSecond.find((match) => match.id === "r2-m1")).toMatchObject({
      sideAEntryId: "a",
      sideBEntryId: "c",
      status: "READY"
    });
  });
});

describe("league tournaments", () => {
  it("generates every pairing exactly once for even and odd fields", () => {
    const even = generateRoundRobinFixtures(["a", "b", "c", "d"]);
    const odd = generateRoundRobinFixtures(["a", "b", "c", "d", "e"]);
    expect(even).toHaveLength(6);
    expect(odd).toHaveLength(10);
    const pairKeys = odd.map((fixture) =>
      [fixture.sideAEntryId, fixture.sideBEntryId].sort().join(":")
    );
    expect(new Set(pairKeys).size).toBe(10);
    expect(new Set(odd.map((fixture) => fixture.round)).size).toBe(5);
  });

  it("applies customizable league points", () => {
    const rows = calculateLeagueStandings(
      [
        { id: "a", seed: 1 },
        { id: "b", seed: 2 },
        { id: "c", seed: 3 }
      ],
      [
        {
          round: 1,
          slot: 0,
          sideAEntryId: "a",
          sideBEntryId: "b",
          outcome: "A",
          scoreA: 3,
          scoreB: 1
        },
        {
          round: 2,
          slot: 0,
          sideAEntryId: "b",
          sideBEntryId: "c",
          outcome: "DRAW",
          scoreA: 2,
          scoreB: 2
        }
      ],
      { win: 4, draw: 2, loss: 1 }
    );
    expect(rows.find((row) => row.entryId === "a")?.points).toBe(4);
    expect(rows.find((row) => row.entryId === "b")?.points).toBe(3);
    expect(rows.find((row) => row.entryId === "c")?.points).toBe(2);
  });

  it("uses two-way head-to-head before score difference", () => {
    const rows = calculateLeagueStandings(
      [
        { id: "a", seed: 1 },
        { id: "b", seed: 2 }
      ],
      [
        {
          round: 1,
          slot: 0,
          sideAEntryId: "a",
          sideBEntryId: "b",
          outcome: "B",
          scoreA: 100,
          scoreB: 101
        }
      ],
      { win: 0, draw: 0, loss: 0 }
    );
    expect(rows.map((row) => row.entryId)).toEqual(["b", "a"]);
  });

  it("does not use RESULT canonical values as a league score-difference tiebreaker", () => {
    const rows = calculateLeagueStandings(
      [
        { id: "a", seed: 1 },
        { id: "b", seed: 2 },
        { id: "c", seed: 3 },
        { id: "d", seed: 4 }
      ],
      [
        {
          round: 1,
          slot: 0,
          sideAEntryId: "a",
          sideBEntryId: "c",
          outcome: "A",
          scoreA: 1,
          scoreB: 0,
          scoreDifferenceEligible: false
        },
        {
          round: 1,
          slot: 1,
          sideAEntryId: "b",
          sideBEntryId: "d",
          outcome: "A",
          scoreA: 1,
          scoreB: 0,
          scoreDifferenceEligible: false
        }
      ],
      { win: 1, draw: 0, loss: 0 }
    );

    expect(rows.map((row) => row.entryId)).toEqual(["a", "b", "c", "d"]);
    expect(rows.find((row) => row.entryId === "a")?.scoreDifference).toBe(0);
  });
});
