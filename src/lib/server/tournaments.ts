import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  competitionFormats,
  competitionRuleVersions,
  games,
  getDb,
  groupCompetitions,
  players,
  tournamentEntries,
  tournamentEntryPlayers,
  tournamentMatches,
  tournaments
} from "@/db";
import {
  calculateLeagueStandings,
  generateRoundRobinFixtures,
  generateSingleEliminationBracket,
  tournamentCompletionDate
} from "@/lib/domain";
import {
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { conflict, unavailable, validationError } from "@/lib/server/errors";
import { tournamentInputSchema } from "@/lib/validation/entities";
import type { TournamentListStatus } from "@/lib/tournament-status";

export async function createTournamentDraft(input: unknown) {
  const data = tournamentInputSchema.parse(input);
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  const [[competition], [format]] = await Promise.all([
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
      .limit(1),
    db
      .select()
      .from(competitionFormats)
      .where(
        and(
          eq(competitionFormats.id, data.formatId),
          eq(competitionFormats.competitionId, data.competitionId),
          eq(competitionFormats.groupId, data.groupId),
          isNull(competitionFormats.archivedAt)
        )
      )
      .limit(1)
  ]);
  if (!competition || !format) throw unavailable();

  const allPlayerIds = data.entries.flatMap((entry) => entry.playerIds);
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    throw validationError("A player may enter a tournament only once.");
  }
  if (
    data.entries.some(
      (entry) => entry.playerIds.length !== format.playersPerSide
    )
  ) {
    throw validationError(
      `Every entry must contain exactly ${format.playersPerSide} player(s).`
    );
  }
  const selectedPlayers = await db
    .select()
    .from(players)
    .where(
      and(
        eq(players.groupId, data.groupId),
        inArray(players.id, allPlayerIds),
        isNull(players.archivedAt)
      )
    );
  if (selectedPlayers.length !== allPlayerIds.length) {
    throw validationError(
      "Every tournament player must be active and belong to this group."
    );
  }

  return db.transaction(async (tx) => {
    const [rule] = await tx
      .select()
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.competitionId, competition.id),
          eq(competitionRuleVersions.groupId, data.groupId),
          eq(competitionRuleVersions.version, competition.currentRuleVersion)
        )
      )
      .limit(1);
    if (!rule) throw unavailable();

    const [tournament] = await tx
      .insert(tournaments)
      .values({
        groupId: data.groupId,
        competitionId: data.competitionId,
        formatId: data.formatId,
        ruleVersionId: rule.id,
        name: data.name,
        type: data.type,
        status: "DRAFT",
        startsAt: data.startsAt,
        bestOf: data.type === "ELIMINATION" ? data.bestOf : null,
        winPoints: data.type === "LEAGUE" ? (data.winPoints ?? 3) : null,
        drawPoints:
          data.type === "LEAGUE" && rule.allowsDraws
            ? (data.drawPoints ?? 1)
            : null,
        lossPoints: data.type === "LEAGUE" ? (data.lossPoints ?? 0) : null,
        createdById: actor.user.id
      })
      .returning();
    if (!tournament) throw new Error("The tournament could not be created.");

    for (const [index, entryInput] of data.entries.entries()) {
      const [entry] = await tx
        .insert(tournamentEntries)
        .values({
          tournamentId: tournament.id,
          groupId: data.groupId,
          name: entryInput.name,
          seed: index + 1
        })
        .returning();
      if (!entry) throw new Error("A tournament entry could not be created.");
      await tx.insert(tournamentEntryPlayers).values(
        entryInput.playerIds.map((playerId, slot) => ({
          entryId: entry.id,
          tournamentId: tournament.id,
          groupId: data.groupId,
          playerId,
          slot
        }))
      );
    }
    return tournament;
  });
}

export async function startTournament(groupId: string, tournamentId: string) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.groupId, groupId),
        eq(tournaments.status, "DRAFT")
      )
    )
    .limit(1);
  if (!tournament) throw unavailable();

  const entries = await db
    .select()
    .from(tournamentEntries)
    .where(
      and(
        eq(tournamentEntries.tournamentId, tournamentId),
        eq(tournamentEntries.groupId, groupId)
      )
    )
    .orderBy(tournamentEntries.seed);
  if (entries.length < 2) {
    throw validationError("A tournament needs at least two entries.");
  }

  const generated =
    tournament.type === "ELIMINATION"
      ? generateSingleEliminationBracket(
          entries.map((entry) => ({ id: entry.id, seed: entry.seed }))
        )
      : generateRoundRobinFixtures(entries.map((entry) => entry.id)).map(
          (fixture) => ({
            id: `league-r${fixture.round}-m${fixture.slot + 1}`,
            ...fixture,
            winnerEntryId: null,
            nextMatchId: null,
            nextMatchSide: null,
            status: "READY" as const
          })
        );

  const ids = new Map(generated.map((match) => [match.id, randomUUID()]));
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from tournaments where id = ${tournamentId} and group_id = ${groupId} for update`
    );
    const [lockedTournament] = await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(
        and(
          eq(tournaments.id, tournamentId),
          eq(tournaments.groupId, groupId),
          eq(tournaments.status, "DRAFT")
        )
      )
      .limit(1);
    if (!lockedTournament) {
      throw conflict("This tournament can no longer be started.");
    }
    await tx.insert(tournamentMatches).values(
      generated.map((match) => ({
        id: ids.get(match.id)!,
        tournamentId,
        groupId,
        round: match.round,
        slot: match.slot,
        sideAEntryId: match.sideAEntryId,
        sideBEntryId: match.sideBEntryId,
        winnerEntryId: match.winnerEntryId,
        nextMatchId: match.nextMatchId ? ids.get(match.nextMatchId)! : null,
        nextMatchSide: match.nextMatchSide,
        status: match.status
      }))
    );
    await tx
      .update(tournaments)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(
        and(
          eq(tournaments.id, tournamentId),
          eq(tournaments.groupId, groupId),
          eq(tournaments.status, "DRAFT")
        )
      );
  });
}

export async function listTournaments(
  groupId: string,
  competitionId?: string,
  status?: TournamentListStatus
) {
  const access = await requireGroupViewer(groupId);
  const db = getDb();
  return db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.groupId, groupId),
        competitionId
          ? eq(tournaments.competitionId, competitionId)
          : undefined,
        status
          ? eq(
              tournaments.status,
              status.toUpperCase() as "ACTIVE" | "DRAFT" | "COMPLETED"
            )
          : undefined,
        access.canManage
          ? undefined
          : inArray(tournaments.status, ["ACTIVE", "COMPLETED"])
      )
    )
    .orderBy(asc(tournaments.startsAt));
}

export async function getTournament(
  groupId: string,
  tournamentId: string,
  competitionId?: string
) {
  const access = await requireGroupViewer(groupId);
  const db = getDb();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.groupId, groupId),
        competitionId
          ? eq(tournaments.competitionId, competitionId)
          : undefined,
        access.canManage
          ? undefined
          : inArray(tournaments.status, ["ACTIVE", "COMPLETED"])
      )
    )
    .limit(1);
  if (!tournament) throw unavailable();

  const [entries, matches] = await Promise.all([
    db
      .select()
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, tournamentId),
          eq(tournamentEntries.groupId, groupId)
        )
      )
      .orderBy(tournamentEntries.seed),
    db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, tournamentId),
          eq(tournamentMatches.groupId, groupId)
        )
      )
      .orderBy(tournamentMatches.round, tournamentMatches.slot)
  ]);
  const entryMembers = entries.length
    ? await db
        .select({
          entryId: tournamentEntryPlayers.entryId,
          playerId: players.id,
          displayName: players.displayName
        })
        .from(tournamentEntryPlayers)
        .innerJoin(
          players,
          and(
            eq(players.id, tournamentEntryPlayers.playerId),
            eq(players.groupId, tournamentEntryPlayers.groupId)
          )
        )
        .where(
          and(
            eq(tournamentEntryPlayers.groupId, groupId),
            eq(tournamentEntryPlayers.tournamentId, tournamentId),
            inArray(
              tournamentEntryPlayers.entryId,
              entries.map((entry) => entry.id)
            )
          )
        )
        .orderBy(tournamentEntryPlayers.slot)
    : [];

  let standings = null;
  if (tournament.type === "LEAGUE" && matches.length) {
    const [rule] = await db
      .select({ scoreType: competitionRuleVersions.scoreType })
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.id, tournament.ruleVersionId),
          eq(competitionRuleVersions.groupId, groupId)
        )
      )
      .limit(1);
    if (!rule) throw unavailable();
    const completedMatchIds = matches
      .filter((match) => match.status === "COMPLETED")
      .map((match) => match.id);
    const gameRows = completedMatchIds.length
      ? await db
          .select()
          .from(games)
          .where(
            and(
              eq(games.groupId, groupId),
              inArray(games.tournamentMatchId, completedMatchIds),
              isNull(games.deletedAt)
            )
          )
      : [];
    const matchById = new Map(matches.map((match) => [match.id, match]));
    standings = calculateLeagueStandings(
      entries.map((entry) => ({ id: entry.id, seed: entry.seed })),
      gameRows.flatMap((game) => {
        const match = game.tournamentMatchId
          ? matchById.get(game.tournamentMatchId)
          : null;
        if (!match?.sideAEntryId || !match.sideBEntryId) return [];
        return [
          {
            round: match.round,
            slot: match.slot,
            sideAEntryId: match.sideAEntryId,
            sideBEntryId: match.sideBEntryId,
            outcome: game.outcome,
            scoreA: Number(game.comparableScoreA),
            scoreB: Number(game.comparableScoreB),
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
  }

  return {
    tournament,
    entries: entries.map((entry) => ({
      ...entry,
      members: entryMembers.filter((member) => member.entryId === entry.id)
    })),
    matches,
    standings
  };
}

export async function confirmTournamentResult(
  groupId: string,
  tournamentId: string
) {
  await requireGroupAdmin(groupId);
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from tournaments where id = ${tournamentId} and group_id = ${groupId} for update`
    );
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.id, tournamentId), eq(tournaments.groupId, groupId))
      )
      .limit(1);
    if (!tournament) throw unavailable();
    if (tournament.status === "COMPLETED") return tournament;
    if (tournament.status !== "ACTIVE") {
      throw conflict("Only an active tournament result can be confirmed.");
    }

    const matchRows = await tx
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournamentId, tournamentId),
          eq(tournamentMatches.groupId, groupId)
        )
      )
      .orderBy(tournamentMatches.round, tournamentMatches.slot);
    if (
      !matchRows.length ||
      matchRows.some((match) => match.status !== "COMPLETED")
    ) {
      throw conflict(
        "Complete every tournament match before confirming the final result."
      );
    }

    let winnerEntryId: string | null = null;
    if (tournament.type === "ELIMINATION") {
      const finalMatch = matchRows.find((match) => match.nextMatchId === null);
      winnerEntryId = finalMatch?.winnerEntryId ?? null;
    } else {
      const [[rule], entryRows, gameRows] = await Promise.all([
        tx
          .select({ scoreType: competitionRuleVersions.scoreType })
          .from(competitionRuleVersions)
          .where(
            and(
              eq(competitionRuleVersions.id, tournament.ruleVersionId),
              eq(competitionRuleVersions.groupId, groupId)
            )
          )
          .limit(1),
        tx
          .select()
          .from(tournamentEntries)
          .where(
            and(
              eq(tournamentEntries.tournamentId, tournamentId),
              eq(tournamentEntries.groupId, groupId)
            )
          ),
        tx
          .select()
          .from(games)
          .where(
            and(
              eq(games.groupId, groupId),
              inArray(
                games.tournamentMatchId,
                matchRows.map((match) => match.id)
              ),
              isNull(games.deletedAt)
            )
          )
      ]);
      if (!rule) throw unavailable();
      const matchById = new Map(matchRows.map((match) => [match.id, match]));
      const standings = calculateLeagueStandings(
        entryRows.map((entry) => ({ id: entry.id, seed: entry.seed })),
        gameRows.flatMap((game) => {
          const match = game.tournamentMatchId
            ? matchById.get(game.tournamentMatchId)
            : null;
          if (!match?.sideAEntryId || !match.sideBEntryId) return [];
          return [
            {
              round: match.round,
              slot: match.slot,
              sideAEntryId: match.sideAEntryId,
              sideBEntryId: match.sideBEntryId,
              outcome: game.outcome,
              scoreA: Number(game.comparableScoreA),
              scoreB: Number(game.comparableScoreB),
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
      winnerEntryId = standings[0]?.entryId ?? null;
    }

    if (!winnerEntryId || tournament.winnerEntryId !== winnerEntryId) {
      throw conflict(
        "The calculated winner has changed. Reload the tournament before confirming it."
      );
    }

    const [confirmed] = await tx
      .update(tournaments)
      .set({
        status: "COMPLETED",
        endsAt:
          tournament.endsAt ?? tournamentCompletionDate(tournament.startsAt),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(tournaments.id, tournamentId),
          eq(tournaments.groupId, groupId),
          eq(tournaments.status, "ACTIVE")
        )
      )
      .returning();
    if (!confirmed) {
      throw conflict("This tournament result could not be confirmed.");
    }
    return confirmed;
  });
}

export async function cancelTournament(groupId: string, tournamentId: string) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [tournament] = await db
    .update(tournaments)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.groupId, groupId),
        inArray(tournaments.status, ["DRAFT", "ACTIVE"]),
        isNull(tournaments.winnerEntryId)
      )
    )
    .returning();
  if (!tournament)
    throw conflict("This tournament can no longer be cancelled.");
  return tournament;
}
