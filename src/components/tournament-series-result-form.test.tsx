import { describe, expect, it } from "vitest";

import {
  tournamentLegOutcome,
  tournamentSeriesProgress
} from "@/lib/tournament-series-form";

const resultRule = {
  scoreType: "RESULT" as const,
  allowsDraws: false,
  winnerDirection: "HIGHER_WINS" as const
};

describe("tournament series result form", () => {
  it("clinches a best-of-three after two wins and ignores later fields", () => {
    const progress = tournamentSeriesProgress(
      [
        { scoreA: "", scoreB: "", result: "A" },
        { scoreA: "", scoreB: "", result: "A" },
        { scoreA: "", scoreB: "", result: "B" }
      ],
      resultRule,
      [],
      0,
      0,
      3
    );
    expect(progress).toMatchObject({
      sideAWins: 2,
      sideBWins: 0,
      completedLegs: 2,
      clinchedAfter: 1
    });
  });

  it("uses all three games for a two-one series", () => {
    const progress = tournamentSeriesProgress(
      [
        { scoreA: "", scoreB: "", result: "A" },
        { scoreA: "", scoreB: "", result: "B" },
        { scoreA: "", scoreB: "", result: "A" }
      ],
      resultRule,
      [],
      0,
      0,
      3
    );
    expect(progress).toMatchObject({
      sideAWins: 2,
      sideBWins: 1,
      completedLegs: 3,
      clinchedAfter: 2
    });
  });

  it("derives numeric and ordered outcomes using the configured rule", () => {
    expect(
      tournamentLegOutcome(
        { scoreA: "11", scoreB: "8", result: "" },
        {
          scoreType: "NUMERIC",
          allowsDraws: false,
          winnerDirection: "HIGHER_WINS"
        },
        []
      )
    ).toBe("A");
    expect(
      tournamentLegOutcome(
        { scoreA: "Silver", scoreB: "Gold", result: "" },
        {
          scoreType: "ORDERED",
          allowsDraws: false,
          winnerDirection: "HIGHER_WINS"
        },
        ["Bronze", "Silver", "Gold"]
      )
    ).toBe("B");
  });
});
