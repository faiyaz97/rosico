export type WinnerDirection = "HIGHER_WINS" | "LOWER_WINS";

export type NumericScoreRule = {
  type: "NUMERIC";
  allowsDraws: boolean;
  winnerDirection: WinnerDirection;
};

export type OrderedScoreRule = {
  type: "ORDERED";
  allowsDraws: boolean;
  winnerDirection: WinnerDirection;
  values: readonly string[];
};

export type ResultScoreRule = {
  type: "RESULT";
  allowsDraws: boolean;
};

export type ScoreRule = NumericScoreRule | OrderedScoreRule | ResultScoreRule;
export type ExplicitResult = "A" | "B" | "DRAW";

export type CalculatedOutcome = {
  submittedScoreA: string;
  submittedScoreB: string;
  comparableScoreA: number;
  comparableScoreB: number;
  outcome: "A" | "B" | "DRAW";
  winnerSide: "A" | "B" | null;
  loserSide: "A" | "B" | null;
  scoreDifference: number;
};

export class ScoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

function parseNumericScore(value: string): number {
  if (value.trim() === "") {
    throw new ScoreValidationError("A score is required for each side.");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ScoreValidationError(
      "Numeric scores must be finite non-negative numbers."
    );
  }

  return parsed;
}

function validateOrderedValues(values: readonly string[]): Map<string, number> {
  if (values.length < 2 || values.length > 64) {
    throw new ScoreValidationError(
      "Ordered scoring requires between 2 and 64 values."
    );
  }

  const positions = new Map<string, number>();
  values.forEach((value, index) => {
    if (value.trim() === "") {
      throw new ScoreValidationError("Ordered score values cannot be blank.");
    }
    if (positions.has(value)) {
      throw new ScoreValidationError("Ordered score values must be unique.");
    }
    positions.set(value, index);
  });
  return positions;
}

export function calculateOutcome(
  rule: ScoreRule,
  submittedScoreA?: string,
  submittedScoreB?: string,
  explicitResult?: ExplicitResult
): CalculatedOutcome {
  let comparableScoreA: number;
  let comparableScoreB: number;

  if (rule.type === "RESULT") {
    if (!explicitResult) {
      throw new ScoreValidationError("A result is required.");
    }
    if (explicitResult === "DRAW" && !rule.allowsDraws) {
      throw new ScoreValidationError("This competition does not allow draws.");
    }
    const aWins = explicitResult === "A";
    const draw = explicitResult === "DRAW";
    return {
      submittedScoreA: draw ? "Draw" : aWins ? "Win" : "Loss",
      submittedScoreB: draw ? "Draw" : aWins ? "Loss" : "Win",
      comparableScoreA: aWins ? 1 : 0,
      comparableScoreB: explicitResult === "B" ? 1 : 0,
      outcome: explicitResult,
      winnerSide: draw ? null : explicitResult,
      loserSide: draw ? null : aWins ? "B" : "A",
      scoreDifference: aWins ? 1 : explicitResult === "B" ? -1 : 0
    };
  }

  if (submittedScoreA === undefined || submittedScoreB === undefined) {
    throw new ScoreValidationError("A score is required for each side.");
  }

  if (rule.type === "NUMERIC") {
    comparableScoreA = parseNumericScore(submittedScoreA);
    comparableScoreB = parseNumericScore(submittedScoreB);
  } else {
    const positions = validateOrderedValues(rule.values);
    const positionA = positions.get(submittedScoreA);
    const positionB = positions.get(submittedScoreB);

    if (positionA === undefined || positionB === undefined) {
      throw new ScoreValidationError(
        "Each submitted score must be one of the configured ordered values."
      );
    }
    comparableScoreA = positionA;
    comparableScoreB = positionB;
  }

  if (comparableScoreA === comparableScoreB) {
    if (!rule.allowsDraws) {
      throw new ScoreValidationError("This competition does not allow draws.");
    }
    return {
      submittedScoreA,
      submittedScoreB,
      comparableScoreA,
      comparableScoreB,
      outcome: "DRAW",
      winnerSide: null,
      loserSide: null,
      scoreDifference: 0
    };
  }

  const aWins =
    rule.winnerDirection === "HIGHER_WINS"
      ? comparableScoreA > comparableScoreB
      : comparableScoreA < comparableScoreB;

  return {
    submittedScoreA,
    submittedScoreB,
    comparableScoreA,
    comparableScoreB,
    outcome: aWins ? "A" : "B",
    winnerSide: aWins ? "A" : "B",
    loserSide: aWins ? "B" : "A",
    scoreDifference: comparableScoreA - comparableScoreB
  };
}
