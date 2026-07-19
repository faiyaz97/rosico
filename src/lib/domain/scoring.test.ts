import { describe, expect, it } from "vitest";

import { calculateOutcome, ScoreValidationError } from "./scoring";

describe("calculateOutcome", () => {
  it("calculates a numeric higher-wins result", () => {
    expect(
      calculateOutcome(
        { type: "NUMERIC", allowsDraws: false, winnerDirection: "HIGHER_WINS" },
        "11",
        "8"
      )
    ).toEqual({
      submittedScoreA: "11",
      submittedScoreB: "8",
      comparableScoreA: 11,
      comparableScoreB: 8,
      outcome: "A",
      winnerSide: "A",
      loserSide: "B",
      scoreDifference: 3
    });
  });

  it("supports lower-wins numeric competitions", () => {
    const result = calculateOutcome(
      { type: "NUMERIC", allowsDraws: false, winnerDirection: "LOWER_WINS" },
      "68",
      "72"
    );
    expect(result.outcome).toBe("A");
    expect(result.scoreDifference).toBe(-4);
  });

  it("uses configured order rather than lexical order", () => {
    const result = calculateOutcome(
      {
        type: "ORDERED",
        allowsDraws: false,
        winnerDirection: "HIGHER_WINS",
        values: ["0", "15", "30", "45"]
      },
      "30",
      "45"
    );
    expect(result).toMatchObject({
      comparableScoreA: 2,
      comparableScoreB: 3,
      outcome: "B",
      scoreDifference: -1
    });
  });

  it("accepts a draw only when configured", () => {
    expect(
      calculateOutcome(
        { type: "NUMERIC", allowsDraws: true, winnerDirection: "HIGHER_WINS" },
        "21",
        "21"
      ).outcome
    ).toBe("DRAW");
    expect(() =>
      calculateOutcome(
        { type: "NUMERIC", allowsDraws: false, winnerDirection: "HIGHER_WINS" },
        "21",
        "21"
      )
    ).toThrow(ScoreValidationError);
  });

  it("canonicalizes explicit results without accepting client score values", () => {
    expect(
      calculateOutcome(
        { type: "RESULT", allowsDraws: true },
        undefined,
        undefined,
        "A"
      )
    ).toEqual({
      submittedScoreA: "Win",
      submittedScoreB: "Loss",
      comparableScoreA: 1,
      comparableScoreB: 0,
      outcome: "A",
      winnerSide: "A",
      loserSide: "B",
      scoreDifference: 1
    });
    expect(() =>
      calculateOutcome(
        { type: "RESULT", allowsDraws: false },
        undefined,
        undefined,
        "DRAW"
      )
    ).toThrow(/does not allow draws/);
  });

  it("rejects invalid numeric and ordered values", () => {
    expect(() =>
      calculateOutcome(
        { type: "NUMERIC", allowsDraws: false, winnerDirection: "HIGHER_WINS" },
        "-1",
        "2"
      )
    ).toThrow(/non-negative/);
    expect(() =>
      calculateOutcome(
        {
          type: "ORDERED",
          allowsDraws: false,
          winnerDirection: "HIGHER_WINS",
          values: ["bronze", "silver", "gold"]
        },
        "platinum",
        "gold"
      )
    ).toThrow(/configured ordered values/);
  });
});
