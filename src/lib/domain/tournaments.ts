export type BracketEntry = {
  id: string;
  seed: number;
};

export type BracketMatch = {
  id: string;
  round: number;
  slot: number;
  sideAEntryId: string | null;
  sideBEntryId: string | null;
  nextMatchId: string | null;
  nextMatchSide: "A" | "B" | null;
  winnerEntryId: string | null;
  status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED";
};

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function tournamentCompletionDate(
  startsAt: Date,
  completedAt = new Date()
): Date {
  return completedAt < startsAt ? startsAt : completedAt;
}

export function requiredWins(bestOf: number): number {
  if (
    !Number.isSafeInteger(bestOf) ||
    bestOf <= 0 ||
    bestOf > 99 ||
    bestOf % 2 === 0
  ) {
    throw new RangeError(
      "Best-of must be a positive odd integer no greater than 99."
    );
  }
  return Math.floor(bestOf / 2) + 1;
}

export function generateSingleEliminationBracket(
  inputEntries: readonly BracketEntry[]
): BracketMatch[] {
  if (inputEntries.length < 2) {
    throw new RangeError(
      "An elimination tournament needs at least two entries."
    );
  }
  const entries = [...inputEntries].sort(
    (left, right) => left.seed - right.seed || left.id.localeCompare(right.id)
  );
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new RangeError("Tournament entries must be unique.");
  }
  if (new Set(entries.map((entry) => entry.seed)).size !== entries.length) {
    throw new RangeError("Tournament seeds must be unique.");
  }

  const bracketSize = nextPowerOfTwo(entries.length);
  const firstRoundMatches = bracketSize / 2;
  const byeCount = bracketSize - entries.length;
  const matches: BracketMatch[] = [];

  for (let slot = 0; slot < firstRoundMatches; slot += 1) {
    const sideA = entries[slot];
    const sideB =
      slot < byeCount
        ? undefined
        : entries[byeCount + (slot - byeCount) * 2 + 1];
    const adjustedSideA =
      slot < byeCount ? sideA : entries[byeCount + (slot - byeCount) * 2];
    const winner = adjustedSideA && !sideB ? adjustedSideA.id : null;
    matches.push({
      id: `r1-m${slot + 1}`,
      round: 1,
      slot,
      sideAEntryId: adjustedSideA?.id ?? null,
      sideBEntryId: sideB?.id ?? null,
      nextMatchId: null,
      nextMatchSide: null,
      winnerEntryId: winner,
      status: winner ? "COMPLETED" : "READY"
    });
  }

  let previousRound = matches.filter((match) => match.round === 1);
  let round = 2;
  while (previousRound.length > 1) {
    const currentRound: BracketMatch[] = [];
    for (let slot = 0; slot < previousRound.length / 2; slot += 1) {
      const match: BracketMatch = {
        id: `r${round}-m${slot + 1}`,
        round,
        slot,
        sideAEntryId: null,
        sideBEntryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        winnerEntryId: null,
        status: "PENDING"
      };
      currentRound.push(match);
      const feederA = previousRound[slot * 2] as BracketMatch;
      const feederB = previousRound[slot * 2 + 1] as BracketMatch;
      feederA.nextMatchId = match.id;
      feederA.nextMatchSide = "A";
      feederB.nextMatchId = match.id;
      feederB.nextMatchSide = "B";
      if (feederA.winnerEntryId) match.sideAEntryId = feederA.winnerEntryId;
      if (feederB.winnerEntryId) match.sideBEntryId = feederB.winnerEntryId;
      match.status =
        match.sideAEntryId && match.sideBEntryId ? "READY" : "PENDING";
    }
    matches.push(...currentRound);
    previousRound = currentRound;
    round += 1;
  }
  return matches;
}

export function applySeriesLeg(
  state: {
    sideAWins: number;
    sideBWins: number;
    bestOf: number;
    winnerEntryId: string | null;
  },
  outcome: "A" | "B" | "DRAW",
  sideAEntryId: string,
  sideBEntryId: string
) {
  if (state.winnerEntryId) {
    throw new Error("The series is already complete.");
  }
  const winsNeeded = requiredWins(state.bestOf);
  const sideAWins = state.sideAWins + (outcome === "A" ? 1 : 0);
  const sideBWins = state.sideBWins + (outcome === "B" ? 1 : 0);
  const winnerEntryId =
    sideAWins >= winsNeeded
      ? sideAEntryId
      : sideBWins >= winsNeeded
        ? sideBEntryId
        : null;
  return {
    sideAWins,
    sideBWins,
    winnerEntryId,
    completed: winnerEntryId !== null
  };
}

export function advanceBracketWinner(
  matches: readonly BracketMatch[],
  matchId: string,
  winnerEntryId: string
): BracketMatch[] {
  const updated = matches.map((match) => ({ ...match }));
  const match = updated.find((candidate) => candidate.id === matchId);
  if (!match) throw new Error("The bracket match does not exist.");
  if (
    winnerEntryId !== match.sideAEntryId &&
    winnerEntryId !== match.sideBEntryId
  ) {
    throw new Error("The winner must be one of the match sides.");
  }
  match.winnerEntryId = winnerEntryId;
  match.status = "COMPLETED";
  if (!match.nextMatchId || !match.nextMatchSide) return updated;

  const nextMatch = updated.find(
    (candidate) => candidate.id === match.nextMatchId
  );
  if (!nextMatch)
    throw new Error("The downstream bracket match does not exist.");
  if (match.nextMatchSide === "A") {
    nextMatch.sideAEntryId = winnerEntryId;
  } else {
    nextMatch.sideBEntryId = winnerEntryId;
  }
  if (nextMatch.sideAEntryId && nextMatch.sideBEntryId) {
    nextMatch.status = "READY";
  }
  return updated;
}

export type RoundRobinFixture = {
  round: number;
  slot: number;
  sideAEntryId: string;
  sideBEntryId: string;
};

export function generateRoundRobinFixtures(
  entryIds: readonly string[]
): RoundRobinFixture[] {
  if (entryIds.length < 2) {
    throw new RangeError("A league tournament needs at least two entries.");
  }
  if (new Set(entryIds).size !== entryIds.length) {
    throw new RangeError("Tournament entries must be unique.");
  }

  const participants: Array<string | null> = [...entryIds];
  if (participants.length % 2 === 1) participants.push(null);
  const rounds = participants.length - 1;
  const fixtures: RoundRobinFixture[] = [];
  const rotating = [...participants];

  for (let round = 1; round <= rounds; round += 1) {
    let slot = 0;
    for (let index = 0; index < rotating.length / 2; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      if (left && right) {
        fixtures.push({
          round,
          slot,
          sideAEntryId: round % 2 === 0 ? right : left,
          sideBEntryId: round % 2 === 0 ? left : right
        });
        slot += 1;
      }
    }
    const fixed = rotating[0] as string | null;
    const rest = rotating.slice(1);
    const last = rest.pop() as string | null;
    rotating.splice(0, rotating.length, fixed, last, ...rest);
  }
  return fixtures;
}

export type LeagueResult = RoundRobinFixture & {
  outcome: "A" | "B" | "DRAW";
  scoreA: number;
  scoreB: number;
  scoreDifferenceEligible?: boolean;
};

export type LeaguePoints = {
  win: number;
  draw: number;
  loss: number;
};

export type LeagueStanding = {
  position: number;
  entryId: string;
  seed: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
};

export function calculateLeagueStandings(
  entries: readonly BracketEntry[],
  results: readonly LeagueResult[],
  points: LeaguePoints = { win: 3, draw: 1, loss: 0 }
): LeagueStanding[] {
  if (
    !Number.isSafeInteger(points.win) ||
    !Number.isSafeInteger(points.draw) ||
    !Number.isSafeInteger(points.loss)
  ) {
    throw new RangeError("League point values must be integers.");
  }
  const table = new Map<string, Omit<LeagueStanding, "position">>();
  for (const entry of entries) {
    table.set(entry.id, {
      entryId: entry.id,
      seed: entry.seed,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0,
      points: 0
    });
  }

  for (const result of results) {
    if (!Number.isFinite(result.scoreA) || !Number.isFinite(result.scoreB)) {
      throw new RangeError("League result scores must be finite numbers.");
    }
    const sideA = table.get(result.sideAEntryId);
    const sideB = table.get(result.sideBEntryId);
    if (!sideA || !sideB || sideA === sideB) {
      throw new Error(
        "League results must reference two distinct tournament entries."
      );
    }
    sideA.played += 1;
    sideB.played += 1;
    if (result.scoreDifferenceEligible !== false) {
      sideA.scoreFor += result.scoreA;
      sideA.scoreAgainst += result.scoreB;
      sideB.scoreFor += result.scoreB;
      sideB.scoreAgainst += result.scoreA;
      sideA.scoreDifference = sideA.scoreFor - sideA.scoreAgainst;
      sideB.scoreDifference = sideB.scoreFor - sideB.scoreAgainst;
    }

    if (result.outcome === "DRAW") {
      sideA.draws += 1;
      sideB.draws += 1;
      sideA.points += points.draw;
      sideB.points += points.draw;
    } else {
      const winner = result.outcome === "A" ? sideA : sideB;
      const loser = result.outcome === "A" ? sideB : sideA;
      winner.wins += 1;
      loser.losses += 1;
      winner.points += points.win;
      loser.points += points.loss;
    }
  }

  const headToHeadWinner = (leftId: string, rightId: string): string | null => {
    const meetings = results.filter(
      (result) =>
        (result.sideAEntryId === leftId && result.sideBEntryId === rightId) ||
        (result.sideAEntryId === rightId && result.sideBEntryId === leftId)
    );
    let leftWins = 0;
    let rightWins = 0;
    for (const meeting of meetings) {
      if (meeting.outcome === "DRAW") continue;
      const winner =
        meeting.outcome === "A" ? meeting.sideAEntryId : meeting.sideBEntryId;
      if (winner === leftId) leftWins += 1;
      if (winner === rightId) rightWins += 1;
    }
    return leftWins === rightWins
      ? null
      : leftWins > rightWins
        ? leftId
        : rightId;
  };

  const pointGroups = new Map<
    number,
    Array<Omit<LeagueStanding, "position">>
  >();
  for (const row of table.values()) {
    const group = pointGroups.get(row.points) ?? [];
    group.push(row);
    pointGroups.set(row.points, group);
  }

  const ordered: Array<Omit<LeagueStanding, "position">> = [];
  for (const [, group] of [...pointGroups.entries()].sort(
    (a, b) => b[0] - a[0]
  )) {
    group.sort((left, right) => {
      if (group.length === 2) {
        const winner = headToHeadWinner(left.entryId, right.entryId);
        if (winner) return winner === left.entryId ? -1 : 1;
      }
      return (
        right.scoreDifference - left.scoreDifference ||
        right.wins - left.wins ||
        right.scoreFor - left.scoreFor ||
        left.seed - right.seed
      );
    });
    ordered.push(...group);
  }

  return ordered.map((row, index) => ({ ...row, position: index + 1 }));
}
