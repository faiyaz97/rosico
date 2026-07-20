import { requiredWins } from "@/lib/domain";

export type TournamentSeriesOutcome = "A" | "B" | "DRAW";

export type TournamentSeriesLeg = {
  scoreA: string;
  scoreB: string;
  result: "" | TournamentSeriesOutcome;
};

export type TournamentSeriesRule = {
  scoreType: "NUMERIC" | "ORDERED" | "RESULT";
  allowsDraws: boolean;
  winnerDirection: "HIGHER_WINS" | "LOWER_WINS";
};

export function tournamentLegOutcome(
  leg: TournamentSeriesLeg,
  rule: TournamentSeriesRule,
  orderedValues: string[]
): TournamentSeriesOutcome | null {
  if (rule.scoreType === "RESULT") return leg.result || null;
  if (!leg.scoreA.trim() || !leg.scoreB.trim()) return null;

  const scoreA =
    rule.scoreType === "ORDERED"
      ? orderedValues.indexOf(leg.scoreA)
      : Number(leg.scoreA);
  const scoreB =
    rule.scoreType === "ORDERED"
      ? orderedValues.indexOf(leg.scoreB)
      : Number(leg.scoreB);
  if (
    !Number.isFinite(scoreA) ||
    !Number.isFinite(scoreB) ||
    scoreA < 0 ||
    scoreB < 0
  ) {
    return null;
  }
  if (scoreA === scoreB) return rule.allowsDraws ? "DRAW" : null;
  const aWins =
    rule.winnerDirection === "HIGHER_WINS" ? scoreA > scoreB : scoreA < scoreB;
  return aWins ? "A" : "B";
}

export function tournamentSeriesProgress(
  legs: TournamentSeriesLeg[],
  rule: TournamentSeriesRule,
  orderedValues: string[],
  initialSideAWins: number,
  initialSideBWins: number,
  bestOf: number
) {
  const winsNeeded = requiredWins(bestOf);
  let sideAWins = initialSideAWins;
  let sideBWins = initialSideBWins;
  let completedLegs = 0;
  let clinchedAfter: number | null = null;

  for (const [index, leg] of legs.entries()) {
    if (clinchedAfter !== null) break;
    const outcome = tournamentLegOutcome(leg, rule, orderedValues);
    if (!outcome) break;
    completedLegs += 1;
    if (outcome === "A") sideAWins += 1;
    if (outcome === "B") sideBWins += 1;
    if (sideAWins >= winsNeeded || sideBWins >= winsNeeded) {
      clinchedAfter = index;
    }
  }

  return {
    sideAWins,
    sideBWins,
    completedLegs,
    clinchedAfter,
    winsNeeded
  };
}
