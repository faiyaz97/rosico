export type MatchHistoryGame = {
  id: string;
  competitionId: string;
  formatId: string;
  tournamentMatchId: string | null;
  scoreA: string;
  scoreB: string;
  outcome: "A" | "B" | "DRAW";
  playedAt: Date;
  createdAt: Date;
  location: string | null;
  sideA: Array<{ playerId: string; displayName: string }>;
  sideB: Array<{ playerId: string; displayName: string }>;
  [key: string]: unknown;
};

export type MatchHistoryTournamentContext = {
  matchId: string;
  tournamentId: string;
  competitionId: string;
  tournamentName: string;
  tournamentType: "ELIMINATION" | "LEAGUE";
  tournamentStatus: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  bestOf: number | null;
  round: number;
  slot: number;
  sideAWins: number;
  sideBWins: number;
  winnerEntryId: string | null;
  sideAEntryId: string | null;
  sideBEntryId: string | null;
  nextMatchId: string | null;
};

export type MatchHistoryItem = MatchHistoryGame & {
  historyHref?: string;
  historyWinner: "A" | "B" | "draw" | "pending";
  legs: MatchHistoryGame[];
  tournament?: {
    id: string;
    matchId: string;
    name: string;
    type: "ELIMINATION" | "LEAGUE";
    status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    bestOf: number | null;
    round: number;
    isFinal: boolean;
    clinchedTournament: boolean;
  };
};

/**
 * Groups the stored game legs of an elimination series into one visible match.
 * Rankings still consume the original games; this only changes history display.
 */
export function aggregateMatchHistory(
  games: MatchHistoryGame[],
  tournamentContexts: MatchHistoryTournamentContext[],
  tournamentHref: (context: MatchHistoryTournamentContext) => string
): MatchHistoryItem[] {
  const contextByMatch = new Map(
    tournamentContexts.map((context) => [context.matchId, context])
  );
  const grouped = new Map<string, MatchHistoryGame[]>();

  for (const game of games) {
    const key = game.tournamentMatchId ?? `game:${game.id}`;
    const current = grouped.get(key) ?? [];
    current.push(game);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group): MatchHistoryItem => {
      const legs = [...group].sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id)
      );
      const latest = legs.reduce((latestGame, game) =>
        game.playedAt.getTime() > latestGame.playedAt.getTime()
          ? game
          : latestGame
      );
      const context = latest.tournamentMatchId
        ? contextByMatch.get(latest.tournamentMatchId)
        : undefined;

      if (!context || context.tournamentType !== "ELIMINATION") {
        return {
          ...latest,
          historyWinner: latest.outcome === "DRAW" ? "draw" : latest.outcome,
          legs,
          ...(context
            ? {
                historyHref: tournamentHref(context),
                tournament: {
                  id: context.tournamentId,
                  matchId: context.matchId,
                  name: context.tournamentName,
                  type: context.tournamentType,
                  status: context.tournamentStatus,
                  bestOf: context.bestOf,
                  round: context.round,
                  isFinal:
                    context.tournamentType === "ELIMINATION" &&
                    context.nextMatchId === null,
                  clinchedTournament:
                    context.tournamentType === "ELIMINATION" &&
                    context.nextMatchId === null &&
                    context.winnerEntryId !== null
                }
              }
            : {})
        };
      }

      const historyWinner =
        context.winnerEntryId === context.sideAEntryId
          ? "A"
          : context.winnerEntryId === context.sideBEntryId
            ? "B"
            : "pending";

      return {
        ...latest,
        id: context.matchId,
        scoreA: String(context.sideAWins),
        scoreB: String(context.sideBWins),
        outcome:
          historyWinner === "A" ? "A" : historyWinner === "B" ? "B" : "DRAW",
        historyWinner,
        historyHref: tournamentHref(context),
        legs,
        tournament: {
          id: context.tournamentId,
          matchId: context.matchId,
          name: context.tournamentName,
          type: context.tournamentType,
          status: context.tournamentStatus,
          bestOf: context.bestOf,
          round: context.round,
          isFinal:
            context.tournamentType === "ELIMINATION" &&
            context.nextMatchId === null,
          clinchedTournament:
            context.tournamentType === "ELIMINATION" &&
            context.nextMatchId === null &&
            context.winnerEntryId !== null
        }
      };
    })
    .sort(
      (left, right) =>
        right.playedAt.getTime() - left.playedAt.getTime() ||
        right.id.localeCompare(left.id)
    );
}
