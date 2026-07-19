import { describe, expect, it } from "vitest";

import { customCompetitionInputSchema, gameInputSchema } from "./entities";

const game = {
  groupId: "11111111-1111-4111-8111-111111111111",
  competitionId: "22222222-2222-4222-8222-222222222222",
  formatId: "33333333-3333-4333-8333-333333333333",
  sideAPlayerIds: ["44444444-4444-4444-8444-444444444444"],
  sideBPlayerIds: ["55555555-5555-4555-8555-555555555555"]
};

describe("gameInputSchema", () => {
  it("accepts either two scores or an explicit result", () => {
    expect(
      gameInputSchema.safeParse({ ...game, scoreA: "3", scoreB: "2" }).success
    ).toBe(true);
    expect(gameInputSchema.safeParse({ ...game, result: "DRAW" }).success).toBe(
      true
    );
  });

  it("rejects missing, partial, and injected score/result inputs", () => {
    expect(gameInputSchema.safeParse(game).success).toBe(false);
    expect(gameInputSchema.safeParse({ ...game, scoreA: "3" }).success).toBe(
      false
    );
    expect(
      gameInputSchema.safeParse({
        ...game,
        scoreA: "3",
        scoreB: "2",
        result: "A"
      }).success
    ).toBe(false);
  });
});

describe("customCompetitionInputSchema", () => {
  it("rejects duplicate team sizes", () => {
    expect(
      customCompetitionInputSchema.safeParse({
        groupId: game.groupId,
        name: "Duplicate format competition",
        allowsDraws: false,
        scoreType: "NUMERIC",
        winnerDirection: "HIGHER_WINS",
        formats: [
          { label: "Singles", playersPerSide: 1 },
          { label: "Also singles", playersPerSide: 1 }
        ]
      }).success
    ).toBe(false);
  });
});
