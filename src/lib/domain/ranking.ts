import type { PeriodRange } from "./periods";
import { isWithinPeriod } from "./periods";

export type RankingGame = {
  id: string;
  playedAt: Date;
  formatId: string;
  sideAPlayerIds: readonly string[];
  sideBPlayerIds: readonly string[];
  comparableScoreA: number;
  comparableScoreB: number;
  outcome: "A" | "B" | "DRAW";
  scoreDifferenceEligible?: boolean;
};

export type RankingPlayer = {
  id: string;
  displayName: string;
  imagePath?: string | null;
};

export type RankingRow = {
  position: number;
  playerId: string;
  displayName: string;
  imagePath: string | null;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winPercentage: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  currentStreak: string;
  mostRecentWin: Date | null;
};

type MutableStats = Omit<
  RankingRow,
  "position" | "displayName" | "imagePath" | "winPercentage" | "currentStreak"
> & {
  results: Array<{ playedAt: Date; result: "W" | "D" | "L" }>;
};

type HeadToHeadStats = {
  games: number;
  wins: number;
};

export type RankingOptions = {
  formatId?: string | "all";
  period?: PeriodRange;
  useScoreDifferenceTieBreaker?: boolean;
};

function compareRatio(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number
): number {
  return leftNumerator * rightDenominator - rightNumerator * leftDenominator;
}

function resultForSide(outcome: RankingGame["outcome"], side: "A" | "B") {
  if (outcome === "DRAW") return "D" as const;
  return outcome === side ? ("W" as const) : ("L" as const);
}

function applyGameToPlayer(
  stats: MutableStats,
  game: RankingGame,
  side: "A" | "B"
): void {
  const result = resultForSide(game.outcome, side);
  const scoreFor = side === "A" ? game.comparableScoreA : game.comparableScoreB;
  const scoreAgainst =
    side === "A" ? game.comparableScoreB : game.comparableScoreA;

  stats.gamesPlayed += 1;
  stats.wins += result === "W" ? 1 : 0;
  stats.draws += result === "D" ? 1 : 0;
  stats.losses += result === "L" ? 1 : 0;
  if (game.scoreDifferenceEligible !== false) {
    stats.scoreFor += scoreFor;
    stats.scoreAgainst += scoreAgainst;
    stats.scoreDifference += scoreFor - scoreAgainst;
  }
  if (
    result === "W" &&
    (!stats.mostRecentWin || game.playedAt > stats.mostRecentWin)
  ) {
    stats.mostRecentWin = game.playedAt;
  }
  stats.results.push({ playedAt: game.playedAt, result });
}

function currentStreak(results: MutableStats["results"]): string {
  if (results.length === 0) return "-";
  const sorted = [...results].sort(
    (left, right) => right.playedAt.getTime() - left.playedAt.getTime()
  );
  const result = sorted[0]?.result;
  if (!result) return "-";
  let length = 0;
  for (const item of sorted) {
    if (item.result !== result) break;
    length += 1;
  }
  return `${result}${length}`;
}

function buildHeadToHead(
  cohortIds: ReadonlySet<string>,
  games: readonly RankingGame[]
): Map<string, HeadToHeadStats> {
  const result = new Map<string, HeadToHeadStats>();
  const get = (playerId: string) => {
    const existing = result.get(playerId);
    if (existing) return existing;
    const created = { games: 0, wins: 0 };
    result.set(playerId, created);
    return created;
  };

  for (const game of games) {
    const sideA = game.sideAPlayerIds.filter((id) => cohortIds.has(id));
    const sideB = game.sideBPlayerIds.filter((id) => cohortIds.has(id));
    if (sideA.length === 0 || sideB.length === 0) continue;

    for (const playerId of [...sideA, ...sideB]) {
      const stats = get(playerId);
      stats.games += 1;
      const side = sideA.includes(playerId) ? "A" : "B";
      if (game.outcome === side) stats.wins += 1;
    }
  }
  return result;
}

function groupByComparator<T>(
  values: readonly T[],
  comparator: (left: T, right: T) => number
): T[][] {
  const sorted = [...values].sort((left, right) => -comparator(left, right));
  const groups: T[][] = [];
  for (const value of sorted) {
    const last = groups.at(-1);
    if (!last || comparator(last[0] as T, value) !== 0) {
      groups.push([value]);
    } else {
      last.push(value);
    }
  }
  return groups;
}

export function calculateRankings(
  players: readonly RankingPlayer[],
  games: readonly RankingGame[],
  options: RankingOptions = {}
): RankingRow[] {
  const filteredGames = games.filter((game) => {
    if (
      options.formatId &&
      options.formatId !== "all" &&
      game.formatId !== options.formatId
    ) {
      return false;
    }
    return !options.period || isWithinPeriod(game.playedAt, options.period);
  });

  const statsByPlayer = new Map<string, MutableStats>();
  const ensureStats = (playerId: string) => {
    const existing = statsByPlayer.get(playerId);
    if (existing) return existing;
    const created: MutableStats = {
      playerId,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0,
      mostRecentWin: null,
      results: []
    };
    statsByPlayer.set(playerId, created);
    return created;
  };

  for (const game of filteredGames) {
    game.sideAPlayerIds.forEach((playerId) =>
      applyGameToPlayer(ensureStats(playerId), game, "A")
    );
    game.sideBPlayerIds.forEach((playerId) =>
      applyGameToPlayer(ensureStats(playerId), game, "B")
    );
  }

  const playerNames = new Map(
    players.map((player) => [player.id, player.displayName])
  );
  const playerImages = new Map(
    players.map((player) => [player.id, player.imagePath ?? null])
  );
  const activeStats = [...statsByPlayer.values()].filter(
    (stats) => stats.gamesPlayed > 0
  );

  const primaryGroups = groupByComparator(activeStats, (left, right) =>
    compareRatio(left.wins, left.gamesPlayed, right.wins, right.gamesPlayed)
  );

  const rankedGroups: MutableStats[][] = [];
  for (const primaryGroup of primaryGroups) {
    const cohortIds = new Set(primaryGroup.map((stats) => stats.playerId));
    const headToHead = buildHeadToHead(cohortIds, filteredGames);
    const hasCompleteHeadToHead = primaryGroup.every(
      (stats) => (headToHead.get(stats.playerId)?.games ?? 0) > 0
    );
    let groups = hasCompleteHeadToHead
      ? groupByComparator(primaryGroup, (left, right) => {
          const leftH2h = headToHead.get(left.playerId) as HeadToHeadStats;
          const rightH2h = headToHead.get(right.playerId) as HeadToHeadStats;
          return compareRatio(
            leftH2h.wins,
            leftH2h.games,
            rightH2h.wins,
            rightH2h.games
          );
        })
      : [primaryGroup];

    const refine = (
      current: MutableStats[][],
      comparator: (left: MutableStats, right: MutableStats) => number
    ) => current.flatMap((group) => groupByComparator(group, comparator));

    groups = refine(groups, (left, right) => left.wins - right.wins);
    if (options.useScoreDifferenceTieBreaker !== false) {
      groups = refine(
        groups,
        (left, right) => left.scoreDifference - right.scoreDifference
      );
    }
    groups = refine(
      groups,
      (left, right) => left.gamesPlayed - right.gamesPlayed
    );
    groups = refine(groups, (left, right) => {
      if (!left.mostRecentWin && !right.mostRecentWin) return 0;
      const leftTime = left.mostRecentWin?.getTime() ?? 0;
      const rightTime = right.mostRecentWin?.getTime() ?? 0;
      return leftTime - rightTime;
    });
    rankedGroups.push(...groups);
  }

  const rows: RankingRow[] = [];
  let position = 1;
  for (const group of rankedGroups) {
    const displayGroup = [...group].sort((left, right) => {
      const nameResult = (
        playerNames.get(left.playerId) ?? left.playerId
      ).localeCompare(
        playerNames.get(right.playerId) ?? right.playerId,
        "en-GB"
      );
      return nameResult || left.playerId.localeCompare(right.playerId);
    });
    for (const stats of displayGroup) {
      rows.push({
        position,
        playerId: stats.playerId,
        displayName: playerNames.get(stats.playerId) ?? "Unknown player",
        imagePath: playerImages.get(stats.playerId) ?? null,
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        winPercentage: (stats.wins / stats.gamesPlayed) * 100,
        scoreFor: stats.scoreFor,
        scoreAgainst: stats.scoreAgainst,
        scoreDifference: stats.scoreDifference,
        currentStreak: currentStreak(stats.results),
        mostRecentWin: stats.mostRecentWin
      });
    }
    position += group.length;
  }
  return rows;
}
