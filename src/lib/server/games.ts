import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql
} from "drizzle-orm";

import {
  competitionFormats,
  competitionRuleVersions,
  gameParticipants,
  gameRevisions,
  games,
  getDb,
  groupCompetitions,
  orderedScoreValues,
  players,
  tournamentEntries,
  tournamentEntryPlayers,
  tournamentMatches,
  tournaments
} from "@/db";
import {
  applySeriesLeg,
  applySeriesLegs,
  calculateLeagueStandings,
  calculateOutcome,
  replaySeries,
  seriesLegPlayedAt,
  tournamentCompletionDate,
  validateGameTeams
} from "@/lib/domain";
import { aggregateMatchHistory } from "@/lib/match-history";
import {
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { conflict, unavailable, validationError } from "@/lib/server/errors";
import {
  gameInputSchema,
  gameUpdateInputSchema,
  tournamentSeriesInputSchema
} from "@/lib/validation/entities";

export async function getCompetitionGameSetup(
  groupId: string,
  competitionId: string,
  options: {
    includeArchivedFormatId?: string;
    pinnedRuleVersionId?: string;
  } = {}
) {
  await requireGroupViewer(groupId);
  const db = getDb();
  const [competition] = await db
    .select()
    .from(groupCompetitions)
    .where(
      and(
        eq(groupCompetitions.id, competitionId),
        eq(groupCompetitions.groupId, groupId),
        options.pinnedRuleVersionId
          ? undefined
          : isNull(groupCompetitions.archivedAt)
      )
    )
    .limit(1);
  if (!competition) throw unavailable();

  const [rule] = await db
    .select()
    .from(competitionRuleVersions)
    .where(
      and(
        eq(competitionRuleVersions.competitionId, competitionId),
        eq(competitionRuleVersions.groupId, groupId),
        options.pinnedRuleVersionId
          ? eq(competitionRuleVersions.id, options.pinnedRuleVersionId)
          : eq(competitionRuleVersions.version, competition.currentRuleVersion)
      )
    )
    .limit(1);
  if (!rule) throw unavailable();

  const [formats, scoreValues, availablePlayers] = await Promise.all([
    db
      .select()
      .from(competitionFormats)
      .where(
        and(
          eq(competitionFormats.competitionId, competitionId),
          eq(competitionFormats.groupId, groupId),
          options.includeArchivedFormatId
            ? or(
                isNull(competitionFormats.archivedAt),
                eq(competitionFormats.id, options.includeArchivedFormatId)
              )
            : isNull(competitionFormats.archivedAt)
        )
      )
      .orderBy(competitionFormats.sortOrder),
    db
      .select()
      .from(orderedScoreValues)
      .where(eq(orderedScoreValues.ruleVersionId, rule.id))
      .orderBy(orderedScoreValues.ordinal),
    db
      .select()
      .from(players)
      .where(and(eq(players.groupId, groupId), isNull(players.archivedAt)))
      .orderBy(asc(players.displayName))
  ]);

  return { competition, rule, formats, scoreValues, players: availablePlayers };
}

export async function recordGame(input: unknown) {
  const parsed = gameInputSchema.safeParse(input);
  if (!parsed.success) {
    const missingTeam = parsed.error.issues.some(
      (issue) =>
        issue.path[0] === "sideAPlayerIds" || issue.path[0] === "sideBPlayerIds"
    );
    if (missingTeam) {
      throw validationError(
        "Choose every required player on both sides before saving."
      );
    }
    throw parsed.error;
  }
  const data = parsed.data;
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  const [competition] = await db
    .select()
    .from(groupCompetitions)
    .where(
      and(
        eq(groupCompetitions.id, data.competitionId),
        eq(groupCompetitions.groupId, data.groupId),
        isNull(groupCompetitions.archivedAt)
      )
    )
    .limit(1);
  if (!competition) throw unavailable();

  const preliminaryTournamentContext = data.tournamentMatchId
    ? await validateTournamentTeams({
        groupId: data.groupId,
        competitionId: data.competitionId,
        formatId: data.formatId,
        tournamentMatchId: data.tournamentMatchId,
        sideAPlayerIds: data.sideAPlayerIds,
        sideBPlayerIds: data.sideBPlayerIds
      })
    : null;
  if (preliminaryTournamentContext?.tournament.type === "ELIMINATION") {
    throw conflict(
      "Elimination matches must be recorded through the best-of series form."
    );
  }

  const [format] = await db
    .select()
    .from(competitionFormats)
    .where(
      and(
        eq(competitionFormats.id, data.formatId),
        eq(competitionFormats.competitionId, data.competitionId),
        eq(competitionFormats.groupId, data.groupId),
        // A validated active tournament owns this pinned format, even if a
        // later configuration revision archived it. Normal games cannot use it.
        preliminaryTournamentContext
          ? undefined
          : isNull(competitionFormats.archivedAt)
      )
    )
    .limit(1);
  if (!format) throw unavailable();

  const [rule] = await db
    .select()
    .from(competitionRuleVersions)
    .where(
      and(
        eq(competitionRuleVersions.competitionId, data.competitionId),
        eq(competitionRuleVersions.groupId, data.groupId),
        preliminaryTournamentContext
          ? eq(
              competitionRuleVersions.id,
              preliminaryTournamentContext.tournament.ruleVersionId
            )
          : eq(competitionRuleVersions.version, competition.currentRuleVersion)
      )
    )
    .limit(1);
  if (!rule) throw unavailable();

  const selectedIds = [...data.sideAPlayerIds, ...data.sideBPlayerIds];
  const selectedPlayers = await db
    .select()
    .from(players)
    .where(
      and(eq(players.groupId, data.groupId), inArray(players.id, selectedIds))
    );
  try {
    validateGameTeams({
      groupId: data.groupId,
      playersPerSide: format.playersPerSide,
      sideAPlayerIds: data.sideAPlayerIds,
      sideBPlayerIds: data.sideBPlayerIds,
      players: selectedPlayers
    });
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "The selected teams are invalid."
    );
  }

  const orderedValues =
    rule.scoreType === "ORDERED"
      ? await db
          .select()
          .from(orderedScoreValues)
          .where(eq(orderedScoreValues.ruleVersionId, rule.id))
          .orderBy(orderedScoreValues.ordinal)
      : [];

  if (rule.scoreType === "RESULT" && !data.result) {
    throw validationError(
      "Select whether side A won, side B won, or the game was drawn."
    );
  }
  if (rule.scoreType !== "RESULT" && data.result) {
    throw validationError("This competition requires a score for each side.");
  }

  let outcome: ReturnType<typeof calculateOutcome>;
  try {
    outcome = calculateOutcome(
      rule.scoreType === "ORDERED"
        ? {
            type: "ORDERED",
            allowsDraws: rule.allowsDraws,
            winnerDirection: rule.winnerDirection,
            values: orderedValues.map((value) => value.value)
          }
        : rule.scoreType === "RESULT"
          ? {
              type: "RESULT",
              allowsDraws: rule.allowsDraws
            }
          : {
              type: "NUMERIC",
              allowsDraws: rule.allowsDraws,
              winnerDirection: rule.winnerDirection
            },
      data.scoreA,
      data.scoreB,
      data.result
    );
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "The score is invalid."
    );
  }

  return db.transaction(async (tx) => {
    let tournamentContext = preliminaryTournamentContext;
    if (data.tournamentMatchId) {
      if (!preliminaryTournamentContext) throw unavailable();
      await tx.execute(
        sql`select id from tournaments where id = ${preliminaryTournamentContext.tournament.id} and group_id = ${data.groupId} for update`
      );
      await tx.execute(
        sql`select id from tournament_matches where id = ${data.tournamentMatchId} and group_id = ${data.groupId} for update`
      );
      const [lockedContext] = await tx
        .select({ match: tournamentMatches, tournament: tournaments })
        .from(tournamentMatches)
        .innerJoin(
          tournaments,
          and(
            eq(tournaments.id, tournamentMatches.tournamentId),
            eq(tournaments.groupId, tournamentMatches.groupId)
          )
        )
        .where(
          and(
            eq(tournamentMatches.id, data.tournamentMatchId),
            eq(tournamentMatches.groupId, data.groupId),
            eq(tournaments.competitionId, data.competitionId),
            eq(tournaments.formatId, data.formatId),
            eq(tournaments.status, "ACTIVE")
          )
        )
        .limit(1);
      if (
        !lockedContext?.match.sideAEntryId ||
        !lockedContext.match.sideBEntryId ||
        !["READY", "IN_PROGRESS"].includes(lockedContext.match.status) ||
        (lockedContext.tournament.type === "LEAGUE" &&
          lockedContext.match.status !== "READY")
      ) {
        throw conflict("This tournament match is not accepting results.");
      }
      tournamentContext = lockedContext;
    }
    const [game] = await tx
      .insert(games)
      .values({
        groupId: data.groupId,
        competitionId: data.competitionId,
        formatId: data.formatId,
        ruleVersionId: rule.id,
        tournamentMatchId: data.tournamentMatchId,
        scoreA: outcome.submittedScoreA,
        scoreB: outcome.submittedScoreB,
        comparableScoreA: String(outcome.comparableScoreA),
        comparableScoreB: String(outcome.comparableScoreB),
        outcome: outcome.outcome,
        scoreDifference: String(outcome.scoreDifference),
        playedAt: data.playedAt ?? new Date(),
        location: data.location,
        createdById: actor.user.id,
        updatedById: actor.user.id
      })
      .returning();
    if (!game) throw new Error("The result could not be saved.");

    await tx.insert(gameParticipants).values([
      ...data.sideAPlayerIds.map((playerId, slot) => ({
        gameId: game.id,
        groupId: data.groupId,
        playerId,
        side: "A" as const,
        slot
      })),
      ...data.sideBPlayerIds.map((playerId, slot) => ({
        gameId: game.id,
        groupId: data.groupId,
        playerId,
        side: "B" as const,
        slot
      }))
    ]);
    await tx.insert(gameRevisions).values({
      gameId: game.id,
      groupId: data.groupId,
      actorId: actor.user.id,
      action: "CREATE",
      snapshot: {
        ...game,
        sideAPlayerIds: data.sideAPlayerIds,
        sideBPlayerIds: data.sideBPlayerIds
      }
    });

    if (tournamentContext) {
      const { match, tournament } = tournamentContext;
      if (tournament.type === "ELIMINATION") {
        if (!match.sideAEntryId || !match.sideBEntryId || !tournament.bestOf) {
          throw unavailable();
        }
        const series = applySeriesLeg(
          {
            sideAWins: match.sideAWins,
            sideBWins: match.sideBWins,
            bestOf: tournament.bestOf,
            winnerEntryId: match.winnerEntryId
          },
          outcome.outcome,
          match.sideAEntryId,
          match.sideBEntryId
        );
        await tx
          .update(tournamentMatches)
          .set({
            sideAWins: series.sideAWins,
            sideBWins: series.sideBWins,
            winnerEntryId: series.winnerEntryId,
            status: series.completed ? "COMPLETED" : "IN_PROGRESS",
            updatedAt: new Date()
          })
          .where(
            and(
              eq(tournamentMatches.id, match.id),
              eq(tournamentMatches.tournamentId, tournament.id),
              eq(tournamentMatches.groupId, data.groupId)
            )
          );

        if (series.winnerEntryId && match.nextMatchId && match.nextMatchSide) {
          await tx
            .update(tournamentMatches)
            .set({
              ...(match.nextMatchSide === "A"
                ? { sideAEntryId: series.winnerEntryId }
                : { sideBEntryId: series.winnerEntryId }),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tournamentMatches.id, match.nextMatchId),
                eq(tournamentMatches.tournamentId, tournament.id),
                eq(tournamentMatches.groupId, data.groupId),
                isNull(tournamentMatches.winnerEntryId)
              )
            );
          await tx
            .update(tournamentMatches)
            .set({ status: "READY", updatedAt: new Date() })
            .where(
              and(
                eq(tournamentMatches.id, match.nextMatchId),
                eq(tournamentMatches.tournamentId, tournament.id),
                eq(tournamentMatches.groupId, data.groupId),
                sql`${tournamentMatches.sideAEntryId} is not null`,
                sql`${tournamentMatches.sideBEntryId} is not null`
              )
            );
        } else if (series.winnerEntryId && !match.nextMatchId) {
          await tx
            .update(tournaments)
            .set({
              winnerEntryId: series.winnerEntryId,
              endsAt: tournamentCompletionDate(tournament.startsAt),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tournaments.id, tournament.id),
                eq(tournaments.groupId, data.groupId),
                eq(tournaments.status, "ACTIVE")
              )
            );
        }
      } else {
        await tx
          .update(tournamentMatches)
          .set({
            winnerEntryId:
              outcome.outcome === "A"
                ? match.sideAEntryId
                : outcome.outcome === "B"
                  ? match.sideBEntryId
                  : null,
            status: "COMPLETED",
            updatedAt: new Date()
          })
          .where(
            and(
              eq(tournamentMatches.id, match.id),
              eq(tournamentMatches.tournamentId, tournament.id),
              eq(tournamentMatches.groupId, data.groupId),
              eq(tournamentMatches.status, "READY")
            )
          );

        const [remaining] = await tx
          .select({ value: count() })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, tournament.id),
              eq(tournamentMatches.groupId, data.groupId),
              ne(tournamentMatches.status, "COMPLETED")
            )
          );
        if ((remaining?.value ?? 0) === 0) {
          const [entryRows, matchRows] = await Promise.all([
            tx
              .select()
              .from(tournamentEntries)
              .where(
                and(
                  eq(tournamentEntries.tournamentId, tournament.id),
                  eq(tournamentEntries.groupId, data.groupId)
                )
              ),
            tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.tournamentId, tournament.id),
                  eq(tournamentMatches.groupId, data.groupId)
                )
              )
          ]);
          const matchIds = matchRows.map((row) => row.id);
          const gameRows = matchIds.length
            ? await tx
                .select()
                .from(games)
                .where(
                  and(
                    eq(games.groupId, data.groupId),
                    inArray(games.tournamentMatchId, matchIds),
                    isNull(games.deletedAt)
                  )
                )
            : [];
          const matchesById = new Map(matchRows.map((row) => [row.id, row]));
          const standings = calculateLeagueStandings(
            entryRows.map((entry) => ({ id: entry.id, seed: entry.seed })),
            gameRows.flatMap((row) => {
              const leagueMatch = row.tournamentMatchId
                ? matchesById.get(row.tournamentMatchId)
                : undefined;
              if (!leagueMatch?.sideAEntryId || !leagueMatch.sideBEntryId) {
                return [];
              }
              return [
                {
                  round: leagueMatch.round,
                  slot: leagueMatch.slot,
                  sideAEntryId: leagueMatch.sideAEntryId,
                  sideBEntryId: leagueMatch.sideBEntryId,
                  outcome: row.outcome,
                  scoreA: Number(row.comparableScoreA),
                  scoreB: Number(row.comparableScoreB),
                  // RESULT persists canonical 1-0 values only to represent the
                  // outcome; they must not become a league margin tiebreaker.
                  scoreDifferenceEligible: rule.scoreType !== "RESULT"
                }
              ];
            }),
            {
              win: tournament.winPoints ?? 3,
              draw: tournament.drawPoints ?? 1,
              loss: tournament.lossPoints ?? 0
            }
          );
          const winnerEntryId = standings[0]?.entryId;
          if (!winnerEntryId) {
            throw new Error("The completed league has no winner.");
          }
          await tx
            .update(tournaments)
            .set({
              winnerEntryId,
              endsAt: tournamentCompletionDate(tournament.startsAt),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(tournaments.id, tournament.id),
                eq(tournaments.groupId, data.groupId),
                eq(tournaments.status, "ACTIVE")
              )
            );
        }
      }
    }

    return game;
  });
}

/**
 * Records several legs of one active elimination match as one transaction.
 * Each leg remains a normal game so rankings and player statistics include it.
 */
export async function recordTournamentSeries(input: unknown) {
  const parsed = tournamentSeriesInputSchema.safeParse(input);
  if (!parsed.success) throw parsed.error;
  const data = parsed.data;
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  const preliminary = await validateTournamentTeams({
    groupId: data.groupId,
    competitionId: data.competitionId,
    formatId: data.formatId,
    tournamentMatchId: data.tournamentMatchId,
    sideAPlayerIds: data.sideAPlayerIds,
    sideBPlayerIds: data.sideBPlayerIds
  });
  if (preliminary.tournament.type !== "ELIMINATION") {
    throw conflict("Only elimination matches can record a series.");
  }

  const [competition, format, rule] = await Promise.all([
    db
      .select()
      .from(groupCompetitions)
      .where(
        and(
          eq(groupCompetitions.id, data.competitionId),
          eq(groupCompetitions.groupId, data.groupId),
          isNull(groupCompetitions.archivedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(competitionFormats)
      .where(
        and(
          eq(competitionFormats.id, data.formatId),
          eq(competitionFormats.competitionId, data.competitionId),
          eq(competitionFormats.groupId, data.groupId)
        )
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.id, preliminary.tournament.ruleVersionId),
          eq(competitionRuleVersions.competitionId, data.competitionId),
          eq(competitionRuleVersions.groupId, data.groupId)
        )
      )
      .limit(1)
      .then((rows) => rows[0])
  ]);
  if (!competition || !format || !rule) throw unavailable();

  const selectedIds = [...data.sideAPlayerIds, ...data.sideBPlayerIds];
  const [selectedPlayers, orderedValues] = await Promise.all([
    db
      .select()
      .from(players)
      .where(
        and(eq(players.groupId, data.groupId), inArray(players.id, selectedIds))
      ),
    rule.scoreType === "ORDERED"
      ? db
          .select()
          .from(orderedScoreValues)
          .where(eq(orderedScoreValues.ruleVersionId, rule.id))
          .orderBy(orderedScoreValues.ordinal)
      : Promise.resolve([])
  ]);
  try {
    validateGameTeams({
      groupId: data.groupId,
      playersPerSide: format.playersPerSide,
      sideAPlayerIds: data.sideAPlayerIds,
      sideBPlayerIds: data.sideBPlayerIds,
      players: selectedPlayers
    });
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "The selected teams are invalid."
    );
  }

  const outcomes = data.legs.map((leg) => {
    if (rule.scoreType === "RESULT" && !leg.result) {
      throw validationError("Select a result for every series leg.");
    }
    if (rule.scoreType !== "RESULT" && leg.result) {
      throw validationError(
        "This competition requires a score for each series leg."
      );
    }
    try {
      return calculateOutcome(
        rule.scoreType === "ORDERED"
          ? {
              type: "ORDERED",
              allowsDraws: rule.allowsDraws,
              winnerDirection: rule.winnerDirection,
              values: orderedValues.map((value) => value.value)
            }
          : rule.scoreType === "RESULT"
            ? { type: "RESULT", allowsDraws: rule.allowsDraws }
            : {
                type: "NUMERIC",
                allowsDraws: rule.allowsDraws,
                winnerDirection: rule.winnerDirection
              },
        leg.scoreA,
        leg.scoreB,
        leg.result
      );
    } catch (error) {
      throw validationError(
        error instanceof Error ? error.message : "A series score is invalid."
      );
    }
  });

  const seriesPlayedAt = data.playedAt ?? new Date();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from tournaments where id = ${preliminary.tournament.id} and group_id = ${data.groupId} for update`
    );
    await tx.execute(
      sql`select id from tournament_matches where id = ${data.tournamentMatchId} and group_id = ${data.groupId} for update`
    );
    const [context] = await tx
      .select({ match: tournamentMatches, tournament: tournaments })
      .from(tournamentMatches)
      .innerJoin(
        tournaments,
        and(
          eq(tournaments.id, tournamentMatches.tournamentId),
          eq(tournaments.groupId, tournamentMatches.groupId)
        )
      )
      .where(
        and(
          eq(tournamentMatches.id, data.tournamentMatchId),
          eq(tournamentMatches.groupId, data.groupId),
          eq(tournaments.id, preliminary.tournament.id),
          eq(tournaments.type, "ELIMINATION"),
          eq(tournaments.status, "ACTIVE")
        )
      )
      .limit(1);
    if (
      !context?.match.sideAEntryId ||
      !context.match.sideBEntryId ||
      !context.tournament.bestOf ||
      !["READY", "IN_PROGRESS"].includes(context.match.status)
    ) {
      throw conflict("This tournament match is not accepting results.");
    }

    let series;
    try {
      series = applySeriesLegs(
        {
          sideAWins: context.match.sideAWins,
          sideBWins: context.match.sideBWins,
          bestOf: context.tournament.bestOf,
          winnerEntryId: context.match.winnerEntryId
        },
        outcomes.map((outcome) => outcome.outcome),
        context.match.sideAEntryId,
        context.match.sideBEntryId
      );
    } catch (error) {
      throw validationError(
        error instanceof Error ? error.message : "The series legs are invalid."
      );
    }

    const [latestSeriesGame] = await tx
      .select({ createdAt: games.createdAt })
      .from(games)
      .where(
        and(
          eq(games.groupId, data.groupId),
          eq(games.tournamentMatchId, data.tournamentMatchId)
        )
      )
      .orderBy(desc(games.createdAt))
      .limit(1);
    const createdAtNow = new Date();
    const seriesCreatedAt =
      latestSeriesGame && latestSeriesGame.createdAt >= createdAtNow
        ? new Date(latestSeriesGame.createdAt.getTime() + 1)
        : createdAtNow;

    const recordedGames = [];
    for (const [legIndex, outcome] of outcomes.entries()) {
      const legCreatedAt = seriesLegPlayedAt(seriesCreatedAt, legIndex);
      const [game] = await tx
        .insert(games)
        .values({
          groupId: data.groupId,
          competitionId: data.competitionId,
          formatId: data.formatId,
          ruleVersionId: rule.id,
          tournamentMatchId: data.tournamentMatchId,
          scoreA: outcome.submittedScoreA,
          scoreB: outcome.submittedScoreB,
          comparableScoreA: String(outcome.comparableScoreA),
          comparableScoreB: String(outcome.comparableScoreB),
          outcome: outcome.outcome,
          scoreDifference: String(outcome.scoreDifference),
          playedAt: seriesLegPlayedAt(seriesPlayedAt, legIndex),
          location: data.location,
          createdById: actor.user.id,
          updatedById: actor.user.id,
          createdAt: legCreatedAt,
          updatedAt: legCreatedAt
        })
        .returning();
      if (!game) throw new Error("The result could not be saved.");
      recordedGames.push(game);
      await tx.insert(gameParticipants).values([
        ...data.sideAPlayerIds.map((playerId, slot) => ({
          gameId: game.id,
          groupId: data.groupId,
          playerId,
          side: "A" as const,
          slot
        })),
        ...data.sideBPlayerIds.map((playerId, slot) => ({
          gameId: game.id,
          groupId: data.groupId,
          playerId,
          side: "B" as const,
          slot
        }))
      ]);
      await tx.insert(gameRevisions).values({
        gameId: game.id,
        groupId: data.groupId,
        actorId: actor.user.id,
        action: "CREATE",
        snapshot: {
          ...game,
          sideAPlayerIds: data.sideAPlayerIds,
          sideBPlayerIds: data.sideBPlayerIds
        }
      });
    }

    await tx
      .update(tournamentMatches)
      .set({
        sideAWins: series.sideAWins,
        sideBWins: series.sideBWins,
        winnerEntryId: series.winnerEntryId,
        status: series.completed ? "COMPLETED" : "IN_PROGRESS",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(tournamentMatches.id, context.match.id),
          eq(tournamentMatches.tournamentId, context.tournament.id),
          eq(tournamentMatches.groupId, data.groupId)
        )
      );

    if (
      series.winnerEntryId &&
      context.match.nextMatchId &&
      context.match.nextMatchSide
    ) {
      await tx
        .update(tournamentMatches)
        .set({
          ...(context.match.nextMatchSide === "A"
            ? { sideAEntryId: series.winnerEntryId }
            : { sideBEntryId: series.winnerEntryId }),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(tournamentMatches.id, context.match.nextMatchId),
            eq(tournamentMatches.tournamentId, context.tournament.id),
            eq(tournamentMatches.groupId, data.groupId),
            isNull(tournamentMatches.winnerEntryId)
          )
        );
      await tx
        .update(tournamentMatches)
        .set({ status: "READY", updatedAt: new Date() })
        .where(
          and(
            eq(tournamentMatches.id, context.match.nextMatchId),
            eq(tournamentMatches.tournamentId, context.tournament.id),
            eq(tournamentMatches.groupId, data.groupId),
            sql`${tournamentMatches.sideAEntryId} is not null`,
            sql`${tournamentMatches.sideBEntryId} is not null`
          )
        );
    } else if (series.winnerEntryId && !context.match.nextMatchId) {
      await tx
        .update(tournaments)
        .set({
          winnerEntryId: series.winnerEntryId,
          endsAt: tournamentCompletionDate(context.tournament.startsAt),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(tournaments.id, context.tournament.id),
            eq(tournaments.groupId, data.groupId),
            eq(tournaments.status, "ACTIVE")
          )
        );
    }

    return recordedGames;
  });
}

async function validateTournamentTeams(input: {
  groupId: string;
  competitionId: string;
  formatId: string;
  tournamentMatchId: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
}) {
  const db = getDb();
  const [context] = await db
    .select({ match: tournamentMatches, tournament: tournaments })
    .from(tournamentMatches)
    .innerJoin(
      tournaments,
      and(
        eq(tournaments.id, tournamentMatches.tournamentId),
        eq(tournaments.groupId, tournamentMatches.groupId)
      )
    )
    .where(
      and(
        eq(tournamentMatches.id, input.tournamentMatchId),
        eq(tournamentMatches.groupId, input.groupId),
        eq(tournaments.competitionId, input.competitionId),
        eq(tournaments.formatId, input.formatId),
        eq(tournaments.status, "ACTIVE")
      )
    )
    .limit(1);
  if (!context?.match.sideAEntryId || !context.match.sideBEntryId) {
    throw unavailable();
  }
  if (
    !["READY", "IN_PROGRESS"].includes(context.match.status) ||
    (context.tournament.type === "LEAGUE" &&
      context.match.status === "IN_PROGRESS")
  ) {
    throw conflict("This tournament match is not accepting results.");
  }

  const members = await db
    .select({
      entryId: tournamentEntryPlayers.entryId,
      playerId: tournamentEntryPlayers.playerId
    })
    .from(tournamentEntryPlayers)
    .where(
      and(
        eq(tournamentEntryPlayers.groupId, input.groupId),
        eq(tournamentEntryPlayers.tournamentId, context.tournament.id),
        inArray(tournamentEntryPlayers.entryId, [
          context.match.sideAEntryId,
          context.match.sideBEntryId
        ])
      )
    );
  const expectedA = members
    .filter((member) => member.entryId === context.match.sideAEntryId)
    .map((member) => member.playerId)
    .sort();
  const expectedB = members
    .filter((member) => member.entryId === context.match.sideBEntryId)
    .map((member) => member.playerId)
    .sort();
  if (
    expectedA.join(",") !== [...input.sideAPlayerIds].sort().join(",") ||
    expectedB.join(",") !== [...input.sideBPlayerIds].sort().join(",")
  ) {
    throw validationError("Tournament matches must use their fixed teams.");
  }
  return context;
}

export async function listGames(groupId: string, competitionId?: string) {
  await requireGroupViewer(groupId);
  const db = getDb();
  const gameRows = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.groupId, groupId),
        isNull(games.deletedAt),
        competitionId ? eq(games.competitionId, competitionId) : undefined
      )
    )
    .orderBy(desc(games.playedAt));
  if (!gameRows.length) return [];

  const [participants, ruleRows] = await Promise.all([
    db
      .select({
        gameId: gameParticipants.gameId,
        side: gameParticipants.side,
        slot: gameParticipants.slot,
        playerId: players.id,
        displayName: players.displayName
      })
      .from(gameParticipants)
      .innerJoin(
        games,
        and(
          eq(games.id, gameParticipants.gameId),
          eq(games.groupId, gameParticipants.groupId)
        )
      )
      .innerJoin(
        players,
        and(
          eq(players.id, gameParticipants.playerId),
          eq(players.groupId, gameParticipants.groupId)
        )
      )
      .where(
        and(
          eq(gameParticipants.groupId, groupId),
          isNull(games.deletedAt),
          competitionId ? eq(games.competitionId, competitionId) : undefined
        )
      )
      .orderBy(gameParticipants.slot),
    db
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
  ]);
  const scoreTypeByRule = new Map(
    ruleRows.map((rule) => [rule.id, rule.scoreType])
  );

  const participantsByGame = new Map<
    string,
    { sideA: typeof participants; sideB: typeof participants }
  >();
  for (const participant of participants) {
    const sides = participantsByGame.get(participant.gameId) ?? {
      sideA: [],
      sideB: []
    };
    (participant.side === "A" ? sides.sideA : sides.sideB).push(participant);
    participantsByGame.set(participant.gameId, sides);
  }
  return gameRows.map((game) => ({
    ...game,
    scoreType: scoreTypeByRule.get(game.ruleVersionId) ?? "NUMERIC",
    sideA: participantsByGame.get(game.id)?.sideA ?? [],
    sideB: participantsByGame.get(game.id)?.sideB ?? []
  }));
}

export async function listMatchHistory(
  groupId: string,
  competitionId?: string
) {
  const gameRows = await listGames(groupId, competitionId);
  const tournamentMatchIds = [
    ...new Set(
      gameRows.flatMap((game) =>
        game.tournamentMatchId ? [game.tournamentMatchId] : []
      )
    )
  ];
  if (!tournamentMatchIds.length) {
    return aggregateMatchHistory(gameRows, [], () => "");
  }

  const db = getDb();
  const contexts = await db
    .select({
      matchId: tournamentMatches.id,
      tournamentId: tournaments.id,
      competitionId: tournaments.competitionId,
      tournamentName: tournaments.name,
      tournamentType: tournaments.type,
      tournamentStatus: tournaments.status,
      bestOf: tournaments.bestOf,
      round: tournamentMatches.round,
      slot: tournamentMatches.slot,
      sideAWins: tournamentMatches.sideAWins,
      sideBWins: tournamentMatches.sideBWins,
      winnerEntryId: tournamentMatches.winnerEntryId,
      sideAEntryId: tournamentMatches.sideAEntryId,
      sideBEntryId: tournamentMatches.sideBEntryId,
      nextMatchId: tournamentMatches.nextMatchId
    })
    .from(tournamentMatches)
    .innerJoin(
      tournaments,
      and(
        eq(tournaments.id, tournamentMatches.tournamentId),
        eq(tournaments.groupId, tournamentMatches.groupId)
      )
    )
    .where(
      and(
        eq(tournamentMatches.groupId, groupId),
        inArray(tournamentMatches.id, tournamentMatchIds)
      )
    );

  return aggregateMatchHistory(
    gameRows,
    contexts,
    (context) =>
      `/app/groups/${groupId}/competitions/${context.competitionId}/tournaments/${context.tournamentId}#match-${context.matchId}`
  );
}

export async function getGame(groupId: string, gameId: string) {
  await requireGroupViewer(groupId);
  const db = getDb();
  const [game] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.id, gameId),
        eq(games.groupId, groupId),
        isNull(games.deletedAt)
      )
    )
    .limit(1);
  if (!game) throw unavailable();
  const [participants, [rule], tournamentContext] = await Promise.all([
    db
      .select({
        side: gameParticipants.side,
        slot: gameParticipants.slot,
        playerId: players.id,
        displayName: players.displayName
      })
      .from(gameParticipants)
      .innerJoin(
        players,
        and(
          eq(players.id, gameParticipants.playerId),
          eq(players.groupId, gameParticipants.groupId)
        )
      )
      .where(
        and(
          eq(gameParticipants.groupId, groupId),
          eq(gameParticipants.gameId, gameId)
        )
      )
      .orderBy(gameParticipants.slot),
    db
      .select({ scoreType: competitionRuleVersions.scoreType })
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.id, game.ruleVersionId),
          eq(competitionRuleVersions.groupId, groupId)
        )
      )
      .limit(1),
    game.tournamentMatchId
      ? db
          .select({
            tournamentId: tournamentMatches.tournamentId,
            competitionId: tournaments.competitionId,
            name: tournaments.name,
            type: tournaments.type,
            bestOf: tournaments.bestOf,
            status: tournaments.status,
            round: tournamentMatches.round,
            slot: tournamentMatches.slot,
            nextMatchId: tournamentMatches.nextMatchId
          })
          .from(tournamentMatches)
          .innerJoin(
            tournaments,
            and(
              eq(tournaments.id, tournamentMatches.tournamentId),
              eq(tournaments.groupId, tournamentMatches.groupId)
            )
          )
          .where(
            and(
              eq(tournamentMatches.id, game.tournamentMatchId),
              eq(tournamentMatches.groupId, groupId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null)
  ]);
  return {
    ...game,
    scoreType: rule?.scoreType ?? "NUMERIC",
    tournament: tournamentContext,
    sideA: participants.filter((participant) => participant.side === "A"),
    sideB: participants.filter((participant) => participant.side === "B")
  };
}

export async function updateGame(input: unknown) {
  const parsed = gameUpdateInputSchema.safeParse(input);
  if (!parsed.success) throw parsed.error;
  const data = parsed.data;
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  const [existing] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.id, data.gameId),
        eq(games.groupId, data.groupId),
        isNull(games.deletedAt)
      )
    )
    .limit(1);
  if (!existing) throw unavailable();
  if (
    existing.competitionId !== data.competitionId ||
    existing.formatId !== data.formatId
  ) {
    throw validationError(
      "A correction cannot move a result to another competition or format."
    );
  }

  const [[format], [rule], currentParticipants] = await Promise.all([
    db
      .select()
      .from(competitionFormats)
      .where(
        and(
          eq(competitionFormats.id, existing.formatId),
          eq(competitionFormats.competitionId, existing.competitionId),
          eq(competitionFormats.groupId, data.groupId)
        )
      )
      .limit(1),
    db
      .select()
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.id, existing.ruleVersionId),
          eq(competitionRuleVersions.competitionId, existing.competitionId),
          eq(competitionRuleVersions.groupId, data.groupId)
        )
      )
      .limit(1),
    db
      .select()
      .from(gameParticipants)
      .where(
        and(
          eq(gameParticipants.gameId, data.gameId),
          eq(gameParticipants.groupId, data.groupId)
        )
      )
      .orderBy(gameParticipants.side, gameParticipants.slot)
  ]);
  if (!format || !rule) throw unavailable();

  const selectedIds = [...data.sideAPlayerIds, ...data.sideBPlayerIds];
  const selectedPlayers = await db
    .select()
    .from(players)
    .where(
      and(eq(players.groupId, data.groupId), inArray(players.id, selectedIds))
    );
  try {
    validateGameTeams({
      groupId: data.groupId,
      playersPerSide: format.playersPerSide,
      sideAPlayerIds: data.sideAPlayerIds,
      sideBPlayerIds: data.sideBPlayerIds,
      players: selectedPlayers.map((player) =>
        currentParticipants.some(
          (participant) => participant.playerId === player.id
        )
          ? { ...player, archivedAt: null }
          : player
      )
    });
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "The selected teams are invalid."
    );
  }

  const orderedValues =
    rule.scoreType === "ORDERED"
      ? await db
          .select()
          .from(orderedScoreValues)
          .where(eq(orderedScoreValues.ruleVersionId, rule.id))
          .orderBy(orderedScoreValues.ordinal)
      : [];
  let outcome: ReturnType<typeof calculateOutcome>;
  try {
    outcome = calculateOutcome(
      rule.scoreType === "ORDERED"
        ? {
            type: "ORDERED",
            allowsDraws: rule.allowsDraws,
            winnerDirection: rule.winnerDirection,
            values: orderedValues.map((value) => value.value)
          }
        : rule.scoreType === "RESULT"
          ? { type: "RESULT", allowsDraws: rule.allowsDraws }
          : {
              type: "NUMERIC",
              allowsDraws: rule.allowsDraws,
              winnerDirection: rule.winnerDirection
            },
      data.scoreA,
      data.scoreB,
      data.result
    );
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : "The corrected score is invalid."
    );
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from games where id = ${data.gameId} and group_id = ${data.groupId} for update`
    );
    const [lockedGame] = await tx
      .select()
      .from(games)
      .where(
        and(
          eq(games.id, data.gameId),
          eq(games.groupId, data.groupId),
          isNull(games.deletedAt)
        )
      )
      .limit(1);
    if (!lockedGame) throw unavailable();
    if (lockedGame.updatedAt.getTime() !== data.expectedUpdatedAt.getTime()) {
      throw conflict(
        "This result changed after you opened it. Reload the page before applying another correction."
      );
    }

    let tournamentContext:
      | {
          match: typeof tournamentMatches.$inferSelect;
          tournament: typeof tournaments.$inferSelect;
        }
      | undefined;
    if (lockedGame.tournamentMatchId) {
      const [context] = await tx
        .select({ match: tournamentMatches, tournament: tournaments })
        .from(tournamentMatches)
        .innerJoin(
          tournaments,
          and(
            eq(tournaments.id, tournamentMatches.tournamentId),
            eq(tournaments.groupId, tournamentMatches.groupId)
          )
        )
        .where(
          and(
            eq(tournamentMatches.id, lockedGame.tournamentMatchId),
            eq(tournamentMatches.groupId, data.groupId)
          )
        )
        .limit(1);
      if (!context?.match.sideAEntryId || !context.match.sideBEntryId) {
        throw unavailable();
      }
      await tx.execute(
        sql`select id from tournaments where id = ${context.tournament.id} and group_id = ${data.groupId} for update`
      );
      await tx.execute(
        sql`select id from tournament_matches where id = ${context.match.id} and group_id = ${data.groupId} for update`
      );
      const [lockedTournament] = await tx
        .select()
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, context.tournament.id),
            eq(tournaments.groupId, data.groupId)
          )
        )
        .limit(1);
      const [lockedMatch] = await tx
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.id, context.match.id),
            eq(tournamentMatches.groupId, data.groupId)
          )
        )
        .limit(1);
      if (
        !lockedTournament ||
        !lockedMatch?.sideAEntryId ||
        !lockedMatch.sideBEntryId
      ) {
        throw unavailable();
      }
      if (lockedTournament.status !== "ACTIVE") {
        throw conflict(
          "This tournament result has been confirmed and can no longer be edited."
        );
      }
      tournamentContext = {
        tournament: lockedTournament,
        match: lockedMatch
      };

      const members = await tx
        .select({
          entryId: tournamentEntryPlayers.entryId,
          playerId: tournamentEntryPlayers.playerId
        })
        .from(tournamentEntryPlayers)
        .where(
          and(
            eq(tournamentEntryPlayers.groupId, data.groupId),
            eq(tournamentEntryPlayers.tournamentId, lockedTournament.id),
            inArray(tournamentEntryPlayers.entryId, [
              lockedMatch.sideAEntryId,
              lockedMatch.sideBEntryId
            ])
          )
        );
      const expectedA = members
        .filter((member) => member.entryId === lockedMatch.sideAEntryId)
        .map((member) => member.playerId)
        .sort();
      const expectedB = members
        .filter((member) => member.entryId === lockedMatch.sideBEntryId)
        .map((member) => member.playerId)
        .sort();
      if (
        expectedA.join(",") !== [...data.sideAPlayerIds].sort().join(",") ||
        expectedB.join(",") !== [...data.sideBPlayerIds].sort().join(",")
      ) {
        throw validationError(
          "Tournament participants are fixed; only the result details can be corrected."
        );
      }
    }

    const updatedAt = new Date();
    const [updated] = await tx
      .update(games)
      .set({
        scoreA: outcome.submittedScoreA,
        scoreB: outcome.submittedScoreB,
        comparableScoreA: String(outcome.comparableScoreA),
        comparableScoreB: String(outcome.comparableScoreB),
        outcome: outcome.outcome,
        scoreDifference: String(outcome.scoreDifference),
        playedAt: data.playedAt ?? lockedGame.playedAt,
        location: data.location ?? null,
        updatedAt,
        updatedById: actor.user.id
      })
      .where(and(eq(games.id, data.gameId), eq(games.groupId, data.groupId)))
      .returning();
    if (!updated) throw unavailable();

    if (!tournamentContext) {
      await tx
        .delete(gameParticipants)
        .where(
          and(
            eq(gameParticipants.gameId, data.gameId),
            eq(gameParticipants.groupId, data.groupId)
          )
        );
      await tx.insert(gameParticipants).values([
        ...data.sideAPlayerIds.map((playerId, slot) => ({
          gameId: data.gameId,
          groupId: data.groupId,
          playerId,
          side: "A" as const,
          slot
        })),
        ...data.sideBPlayerIds.map((playerId, slot) => ({
          gameId: data.gameId,
          groupId: data.groupId,
          playerId,
          side: "B" as const,
          slot
        }))
      ]);
    }

    await tx.insert(gameRevisions).values({
      gameId: data.gameId,
      groupId: data.groupId,
      actorId: actor.user.id,
      action: "UPDATE",
      snapshot: {
        before: lockedGame,
        after: updated,
        sideAPlayerIds: data.sideAPlayerIds,
        sideBPlayerIds: data.sideBPlayerIds
      }
    });

    if (tournamentContext) {
      const { match, tournament } = tournamentContext;
      if (tournament.type === "ELIMINATION") {
        if (!tournament.bestOf || !match.sideAEntryId || !match.sideBEntryId) {
          throw unavailable();
        }
        const legs = await tx
          .select({ id: games.id, outcome: games.outcome })
          .from(games)
          .where(
            and(
              eq(games.groupId, data.groupId),
              eq(games.tournamentMatchId, match.id),
              isNull(games.deletedAt)
            )
          )
          .orderBy(games.createdAt, games.id);
        let series;
        try {
          series = replaySeries(
            legs.map((leg) => leg.outcome),
            tournament.bestOf,
            match.sideAEntryId,
            match.sideBEntryId
          );
        } catch {
          throw conflict(
            "This correction would end the series before a later recorded game. Remove the unnecessary later game first."
          );
        }
        const winnerChanged = series.winnerEntryId !== match.winnerEntryId;
        if (winnerChanged && match.nextMatchId) {
          const [[downstream], [downstreamGames]] = await Promise.all([
            tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.id, match.nextMatchId),
                  eq(tournamentMatches.groupId, data.groupId)
                )
              )
              .limit(1),
            tx
              .select({ value: count() })
              .from(games)
              .where(
                and(
                  eq(games.groupId, data.groupId),
                  eq(games.tournamentMatchId, match.nextMatchId),
                  isNull(games.deletedAt)
                )
              )
          ]);
          if (
            (downstreamGames?.value ?? 0) > 0 ||
            Boolean(downstream?.winnerEntryId)
          ) {
            throw conflict(
              "A later bracket match already has results. Remove those downstream results before changing this winner."
            );
          }
          if (!match.nextMatchSide || !downstream) throw unavailable();
          const nextSideA =
            match.nextMatchSide === "A"
              ? series.winnerEntryId
              : downstream.sideAEntryId;
          const nextSideB =
            match.nextMatchSide === "B"
              ? series.winnerEntryId
              : downstream.sideBEntryId;
          await tx
            .update(tournamentMatches)
            .set({
              sideAEntryId: nextSideA,
              sideBEntryId: nextSideB,
              status: nextSideA && nextSideB ? "READY" : "PENDING",
              updatedAt
            })
            .where(
              and(
                eq(tournamentMatches.id, downstream.id),
                eq(tournamentMatches.groupId, data.groupId)
              )
            );
        }
        await tx
          .update(tournamentMatches)
          .set({
            sideAWins: series.sideAWins,
            sideBWins: series.sideBWins,
            winnerEntryId: series.winnerEntryId,
            status: series.completed
              ? "COMPLETED"
              : legs.length
                ? "IN_PROGRESS"
                : "READY",
            updatedAt
          })
          .where(
            and(
              eq(tournamentMatches.id, match.id),
              eq(tournamentMatches.groupId, data.groupId)
            )
          );
        if (!match.nextMatchId) {
          await tx
            .update(tournaments)
            .set({
              winnerEntryId: series.winnerEntryId,
              endsAt: series.completed
                ? tournamentCompletionDate(tournament.startsAt)
                : null,
              updatedAt
            })
            .where(
              and(
                eq(tournaments.id, tournament.id),
                eq(tournaments.groupId, data.groupId)
              )
            );
        }
      } else {
        await tx
          .update(tournamentMatches)
          .set({
            winnerEntryId:
              outcome.outcome === "A"
                ? match.sideAEntryId
                : outcome.outcome === "B"
                  ? match.sideBEntryId
                  : null,
            status: "COMPLETED",
            updatedAt
          })
          .where(
            and(
              eq(tournamentMatches.id, match.id),
              eq(tournamentMatches.groupId, data.groupId)
            )
          );
        const [remaining] = await tx
          .select({ value: count() })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, tournament.id),
              eq(tournamentMatches.groupId, data.groupId),
              ne(tournamentMatches.status, "COMPLETED")
            )
          );
        if ((remaining?.value ?? 0) === 0) {
          const [entryRows, matchRows, gameRows] = await Promise.all([
            tx
              .select()
              .from(tournamentEntries)
              .where(
                and(
                  eq(tournamentEntries.tournamentId, tournament.id),
                  eq(tournamentEntries.groupId, data.groupId)
                )
              ),
            tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.tournamentId, tournament.id),
                  eq(tournamentMatches.groupId, data.groupId)
                )
              ),
            tx
              .select()
              .from(games)
              .where(
                and(
                  eq(games.groupId, data.groupId),
                  inArray(
                    games.tournamentMatchId,
                    (
                      await tx
                        .select({ id: tournamentMatches.id })
                        .from(tournamentMatches)
                        .where(
                          and(
                            eq(tournamentMatches.tournamentId, tournament.id),
                            eq(tournamentMatches.groupId, data.groupId)
                          )
                        )
                    ).map((row) => row.id)
                  ),
                  isNull(games.deletedAt)
                )
              )
          ]);
          const matchById = new Map(
            matchRows.map((candidate) => [candidate.id, candidate])
          );
          const standings = calculateLeagueStandings(
            entryRows.map((entry) => ({ id: entry.id, seed: entry.seed })),
            gameRows.flatMap((candidate) => {
              const fixture = candidate.tournamentMatchId
                ? matchById.get(candidate.tournamentMatchId)
                : null;
              if (!fixture?.sideAEntryId || !fixture.sideBEntryId) return [];
              return [
                {
                  round: fixture.round,
                  slot: fixture.slot,
                  sideAEntryId: fixture.sideAEntryId,
                  sideBEntryId: fixture.sideBEntryId,
                  outcome: candidate.outcome,
                  scoreA: Number(candidate.comparableScoreA),
                  scoreB: Number(candidate.comparableScoreB),
                  scoreDifferenceEligible: rule.scoreType !== "RESULT"
                }
              ];
            }),
            {
              win: tournament.winPoints ?? 3,
              draw: tournament.drawPoints ?? 1,
              loss: tournament.lossPoints ?? 0
            }
          );
          await tx
            .update(tournaments)
            .set({
              winnerEntryId: standings[0]?.entryId ?? null,
              endsAt: tournamentCompletionDate(tournament.startsAt),
              updatedAt
            })
            .where(
              and(
                eq(tournaments.id, tournament.id),
                eq(tournaments.groupId, data.groupId)
              )
            );
        }
      }
    }

    return updated;
  });
}

export async function removeGame(groupId: string, gameId: string) {
  const actor = await requireGroupAdmin(groupId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(
        and(
          eq(games.id, gameId),
          eq(games.groupId, groupId),
          isNull(games.deletedAt)
        )
      )
      .limit(1);
    if (!game) throw unavailable();
    if (game.tournamentMatchId) {
      throw conflict(
        "Tournament results must be removed from the tournament match view."
      );
    }
    await tx.insert(gameRevisions).values({
      gameId,
      groupId,
      actorId: actor.user.id,
      action: "DELETE",
      snapshot: game
    });
    await tx
      .update(games)
      .set({
        deletedAt: new Date(),
        deletedById: actor.user.id,
        updatedAt: new Date(),
        updatedById: actor.user.id
      })
      .where(and(eq(games.id, gameId), eq(games.groupId, groupId)));
  });
}
