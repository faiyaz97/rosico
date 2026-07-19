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
  calculateLeagueStandings,
  calculateOutcome,
  tournamentCompletionDate,
  validateGameTeams
} from "@/lib/domain";
import {
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { conflict, unavailable, validationError } from "@/lib/server/errors";
import { gameInputSchema } from "@/lib/validation/entities";

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
        isNull(groupCompetitions.archivedAt)
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
              status: "COMPLETED",
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
              status: "COMPLETED",
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
  const [participants, [rule]] = await Promise.all([
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
      .limit(1)
  ]);
  return {
    ...game,
    scoreType: rule?.scoreType ?? "NUMERIC",
    sideA: participants.filter((participant) => participant.side === "A"),
    sideB: participants.filter((participant) => participant.side === "B")
  };
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
