import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  calculateRankings,
  getPeriodRange,
  type RankingPeriod
} from "@/lib/domain";
import {
  competitionRuleVersions,
  gameParticipants,
  games,
  getDb,
  players
} from "@/db";
import { requireGroupViewer } from "@/lib/server/authorization";

export async function getGroupRanking(input: {
  groupId: string;
  competitionId?: string;
  formatId?: string | "all";
  period?: RankingPeriod;
  anchor?: Date;
}) {
  await requireGroupViewer(input.groupId);
  const db = getDb();
  const [playerRows, gameRows] = await Promise.all([
    db
      .select({
        id: players.id,
        displayName: players.displayName,
        imagePath: players.imagePath
      })
      .from(players)
      .where(eq(players.groupId, input.groupId)),
    db
      .select()
      .from(games)
      .where(
        and(
          eq(games.groupId, input.groupId),
          input.competitionId
            ? eq(games.competitionId, input.competitionId)
            : undefined,
          isNull(games.deletedAt)
        )
      )
  ]);

  const participantRows = gameRows.length
    ? await db
        .select()
        .from(gameParticipants)
        .where(
          and(
            eq(gameParticipants.groupId, input.groupId),
            inArray(
              gameParticipants.gameId,
              gameRows.map((game) => game.id)
            )
          )
        )
    : [];
  const ruleRows = gameRows.length
    ? await db
        .select({
          id: competitionRuleVersions.id,
          scoreType: competitionRuleVersions.scoreType
        })
        .from(competitionRuleVersions)
        .where(
          inArray(
            competitionRuleVersions.id,
            gameRows.map((game) => game.ruleVersionId)
          )
        )
    : [];
  const resultRuleIds = new Set(
    ruleRows
      .filter((rule) => rule.scoreType === "RESULT")
      .map((rule) => rule.id)
  );
  const participantsByGame = new Map<string, { A: string[]; B: string[] }>();
  for (const participant of participantRows) {
    const sides = participantsByGame.get(participant.gameId) ?? {
      A: [],
      B: []
    };
    sides[participant.side].push(participant.playerId);
    participantsByGame.set(participant.gameId, sides);
  }
  const rankingGames = gameRows.map((game) => ({
    id: game.id,
    playedAt: game.playedAt,
    formatId: game.formatId,
    sideAPlayerIds: participantsByGame.get(game.id)?.A ?? [],
    sideBPlayerIds: participantsByGame.get(game.id)?.B ?? [],
    comparableScoreA: Number(game.comparableScoreA),
    comparableScoreB: Number(game.comparableScoreB),
    outcome: game.outcome,
    // RESULT stores 1-0 solely as a canonical outcome representation. Exclude
    // those synthetic values from score totals and the margin tiebreaker.
    scoreDifferenceEligible: !resultRuleIds.has(game.ruleVersionId)
  }));

  const period =
    input.period && input.period !== "all"
      ? getPeriodRange(input.period, input.anchor ?? new Date())
      : undefined;
  return {
    rows: calculateRankings(playerRows, rankingGames, {
      formatId: input.formatId,
      period,
      // Raw score margins are meaningful within a competition, but not across
      // heterogeneous numeric and ordered scoring scales.
      useScoreDifferenceTieBreaker: Boolean(input.competitionId)
    }),
    period
  };
}

export function getCompetitionRanking(
  input: Parameters<typeof getGroupRanking>[0] & { competitionId: string }
) {
  return getGroupRanking(input);
}
