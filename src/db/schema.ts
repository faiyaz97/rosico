import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey()
});

export const invitationStatus = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "CANCELLED"
]);
export const scoreType = pgEnum("score_type", ["NUMERIC", "ORDERED", "RESULT"]);
export const winnerDirection = pgEnum("winner_direction", [
  "HIGHER_WINS",
  "LOWER_WINS"
]);
export const gameOutcome = pgEnum("game_outcome", ["A", "B", "DRAW"]);
export const gameSide = pgEnum("game_side", ["A", "B"]);
export const revisionAction = pgEnum("revision_action", [
  "CREATE",
  "UPDATE",
  "DELETE"
]);
export const tournamentType = pgEnum("tournament_type", [
  "ELIMINATION",
  "LEAGUE"
]);
export const tournamentStatus = pgEnum("tournament_status", [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED"
]);
export const matchStatus = pgEnum("match_status", [
  "PENDING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
};

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    imagePath: text("image_path"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("profiles_email_normalized_unique").on(
      sql`lower(${table.email})`
    ),
    check(
      "profiles_display_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`
    ),
    check(
      "profiles_email_normalized",
      sql`${table.email} = lower(btrim(${table.email}))`
    )
  ]
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    imagePath: text("image_path"),
    isPublic: boolean("is_public").notNull().default(false),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps
  },
  (table) => [
    check("groups_name_not_blank", sql`btrim(${table.name}) <> ''`),
    index("groups_creator_idx").on(table.creatorId),
    index("groups_public_idx").on(table.isPublic)
  ]
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    addedById: uuid("added_by_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("group_memberships_user_idx").on(table.userId)
  ]
);

export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedById: uuid("invited_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    acceptedById: uuid("accepted_by_id").references(() => profiles.id, {
      onDelete: "set null"
    }),
    status: invitationStatus("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("group_invitations_pending_unique")
      .on(table.groupId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      "group_invitations_email_normalized",
      sql`${table.email} = lower(btrim(${table.email}))`
    ),
    index("group_invitations_email_idx").on(table.email)
  ]
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    imagePath: text("image_path"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("players_id_group_unique").on(table.id, table.groupId),
    check(
      "players_display_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`
    ),
    index("players_group_active_idx").on(table.groupId, table.archivedAt)
  ]
);

export const catalogueCompetitions = pgTable(
  "catalogue_competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    imagePath: text("image_path"),
    defaultConfiguration: jsonb("default_configuration")
      .$type<{
        allowsDraws: boolean;
        scoreType: "NUMERIC" | "ORDERED" | "RESULT";
        winnerDirection: "HIGHER_WINS" | "LOWER_WINS";
        orderedValues?: string[];
        formats: Array<{ label: string; playersPerSide: number }>;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    check("catalogue_name_not_blank", sql`btrim(${table.name}) <> ''`)
  ]
);

export const groupCompetitions = pgTable(
  "group_competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    catalogueCompetitionId: uuid("catalogue_competition_id").references(
      () => catalogueCompetitions.id,
      { onDelete: "set null" }
    ),
    name: text("name").notNull(),
    description: text("description"),
    imagePath: text("image_path"),
    currentRuleVersion: integer("current_rule_version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("group_competitions_id_group_unique").on(table.id, table.groupId),
    check("group_competitions_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "group_competitions_rule_version_positive",
      sql`${table.currentRuleVersion} > 0`
    ),
    index("group_competitions_group_active_idx").on(
      table.groupId,
      table.archivedAt
    )
  ]
);

export const competitionRuleVersions = pgTable(
  "competition_rule_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    groupId: uuid("group_id").notNull(),
    version: integer("version").notNull(),
    allowsDraws: boolean("allows_draws").notNull().default(false),
    scoreType: scoreType("score_type").notNull(),
    winnerDirection: winnerDirection("winner_direction")
      .notNull()
      .default("HIGHER_WINS"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId, table.groupId],
      foreignColumns: [groupCompetitions.id, groupCompetitions.groupId]
    }).onDelete("cascade"),
    unique("competition_rule_version_unique").on(
      table.competitionId,
      table.version
    ),
    unique("competition_rules_id_scope_unique").on(
      table.id,
      table.competitionId,
      table.groupId
    ),
    check("competition_rule_version_positive", sql`${table.version} > 0`),
    index("competition_rules_group_idx").on(table.groupId)
  ]
);

export const orderedScoreValues = pgTable(
  "ordered_score_values",
  {
    ruleVersionId: uuid("rule_version_id")
      .notNull()
      .references(() => competitionRuleVersions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    ordinal: integer("ordinal").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.ruleVersionId, table.ordinal] }),
    unique("ordered_score_value_unique").on(table.ruleVersionId, table.value),
    check("ordered_score_value_not_blank", sql`btrim(${table.value}) <> ''`),
    check("ordered_score_ordinal_nonnegative", sql`${table.ordinal} >= 0`)
  ]
);

export const competitionFormats = pgTable(
  "competition_formats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id").notNull(),
    groupId: uuid("group_id").notNull(),
    label: text("label").notNull(),
    playersPerSide: integer("players_per_side").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId, table.groupId],
      foreignColumns: [groupCompetitions.id, groupCompetitions.groupId]
    }).onDelete("cascade"),
    unique("competition_formats_id_scope_unique").on(
      table.id,
      table.competitionId,
      table.groupId
    ),
    check(
      "competition_formats_label_not_blank",
      sql`btrim(${table.label}) <> ''`
    ),
    check(
      "competition_formats_team_size_positive",
      sql`${table.playersPerSide} > 0`
    ),
    index("competition_formats_competition_idx").on(
      table.competitionId,
      table.archivedAt
    )
  ]
);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    formatId: uuid("format_id").notNull(),
    ruleVersionId: uuid("rule_version_id").notNull(),
    name: text("name").notNull(),
    imagePath: text("image_path"),
    type: tournamentType("type").notNull(),
    status: tournamentStatus("status").notNull().default("DRAFT"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    bestOf: integer("best_of"),
    winPoints: integer("win_points"),
    drawPoints: integer("draw_points"),
    lossPoints: integer("loss_points"),
    winnerEntryId: uuid("winner_entry_id"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId, table.groupId],
      foreignColumns: [groupCompetitions.id, groupCompetitions.groupId]
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.formatId, table.competitionId, table.groupId],
      foreignColumns: [
        competitionFormats.id,
        competitionFormats.competitionId,
        competitionFormats.groupId
      ]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.ruleVersionId, table.competitionId, table.groupId],
      foreignColumns: [
        competitionRuleVersions.id,
        competitionRuleVersions.competitionId,
        competitionRuleVersions.groupId
      ]
    }).onDelete("restrict"),
    unique("tournaments_id_scope_unique").on(table.id, table.groupId),
    check("tournaments_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "tournaments_best_of_valid",
      sql`${table.bestOf} is null or (${table.bestOf} > 0 and ${table.bestOf} <= 99 and ${table.bestOf} % 2 = 1)`
    ),
    check(
      "tournaments_type_settings_valid",
      sql`(${table.type} = 'ELIMINATION' and ${table.bestOf} is not null and ${table.winPoints} is null and ${table.drawPoints} is null and ${table.lossPoints} is null) or (${table.type} = 'LEAGUE' and ${table.bestOf} is null and ${table.winPoints} is not null and ${table.lossPoints} is not null)`
    ),
    check(
      "tournaments_dates_valid",
      sql`${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`
    ),
    index("tournaments_group_status_idx").on(table.groupId, table.status)
  ]
);

export const tournamentEntries = pgTable(
  "tournament_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id").notNull(),
    groupId: uuid("group_id").notNull(),
    name: text("name").notNull(),
    seed: integer("seed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.tournamentId, table.groupId],
      foreignColumns: [tournaments.id, tournaments.groupId]
    }).onDelete("cascade"),
    unique("tournament_entries_id_scope_unique").on(
      table.id,
      table.tournamentId,
      table.groupId
    ),
    unique("tournament_entries_seed_unique").on(table.tournamentId, table.seed),
    check("tournament_entries_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("tournament_entries_seed_positive", sql`${table.seed} > 0`)
  ]
);

export const tournamentEntryPlayers = pgTable(
  "tournament_entry_players",
  {
    entryId: uuid("entry_id").notNull(),
    tournamentId: uuid("tournament_id").notNull(),
    groupId: uuid("group_id").notNull(),
    playerId: uuid("player_id").notNull(),
    slot: integer("slot").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.playerId] }),
    foreignKey({
      columns: [table.entryId, table.tournamentId, table.groupId],
      foreignColumns: [
        tournamentEntries.id,
        tournamentEntries.tournamentId,
        tournamentEntries.groupId
      ]
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.playerId, table.groupId],
      foreignColumns: [players.id, players.groupId]
    }).onDelete("restrict"),
    unique("tournament_player_once_unique").on(
      table.tournamentId,
      table.playerId
    ),
    unique("tournament_entry_slot_unique").on(table.entryId, table.slot),
    check("tournament_entry_slot_nonnegative", sql`${table.slot} >= 0`)
  ]
);

export const tournamentMatches = pgTable(
  "tournament_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id").notNull(),
    groupId: uuid("group_id").notNull(),
    round: integer("round").notNull(),
    slot: integer("slot").notNull(),
    sideAEntryId: uuid("side_a_entry_id"),
    sideBEntryId: uuid("side_b_entry_id"),
    sideAWins: integer("side_a_wins").notNull().default(0),
    sideBWins: integer("side_b_wins").notNull().default(0),
    winnerEntryId: uuid("winner_entry_id"),
    nextMatchId: uuid("next_match_id"),
    nextMatchSide: gameSide("next_match_side"),
    status: matchStatus("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.tournamentId, table.groupId],
      foreignColumns: [tournaments.id, tournaments.groupId]
    }).onDelete("cascade"),
    unique("tournament_match_round_slot_unique").on(
      table.tournamentId,
      table.round,
      table.slot
    ),
    unique("tournament_matches_id_scope_unique").on(
      table.id,
      table.tournamentId,
      table.groupId
    ),
    unique("tournament_matches_id_group_unique").on(table.id, table.groupId),
    foreignKey({
      columns: [table.sideAEntryId, table.tournamentId, table.groupId],
      foreignColumns: [
        tournamentEntries.id,
        tournamentEntries.tournamentId,
        tournamentEntries.groupId
      ]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.sideBEntryId, table.tournamentId, table.groupId],
      foreignColumns: [
        tournamentEntries.id,
        tournamentEntries.tournamentId,
        tournamentEntries.groupId
      ]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.winnerEntryId, table.tournamentId, table.groupId],
      foreignColumns: [
        tournamentEntries.id,
        tournamentEntries.tournamentId,
        tournamentEntries.groupId
      ]
    }).onDelete("restrict"),
    check("tournament_match_round_positive", sql`${table.round} > 0`),
    check("tournament_match_slot_nonnegative", sql`${table.slot} >= 0`),
    check(
      "tournament_match_wins_nonnegative",
      sql`${table.sideAWins} >= 0 and ${table.sideBWins} >= 0`
    ),
    check(
      "tournament_match_distinct_sides",
      sql`${table.sideAEntryId} is null or ${table.sideBEntryId} is null or ${table.sideAEntryId} <> ${table.sideBEntryId}`
    ),
    index("tournament_matches_tournament_idx").on(
      table.tournamentId,
      table.round
    )
  ]
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    formatId: uuid("format_id").notNull(),
    ruleVersionId: uuid("rule_version_id").notNull(),
    tournamentMatchId: uuid("tournament_match_id"),
    scoreA: text("score_a").notNull(),
    scoreB: text("score_b").notNull(),
    comparableScoreA: numeric("comparable_score_a", {
      precision: 18,
      scale: 6
    }).notNull(),
    comparableScoreB: numeric("comparable_score_b", {
      precision: 18,
      scale: 6
    }).notNull(),
    outcome: gameOutcome("outcome").notNull(),
    scoreDifference: numeric("score_difference", {
      precision: 18,
      scale: 6
    }).notNull(),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    location: text("location"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    updatedById: uuid("updated_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => profiles.id, {
      onDelete: "restrict"
    })
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId, table.groupId],
      foreignColumns: [groupCompetitions.id, groupCompetitions.groupId]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.formatId, table.competitionId, table.groupId],
      foreignColumns: [
        competitionFormats.id,
        competitionFormats.competitionId,
        competitionFormats.groupId
      ]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.ruleVersionId, table.competitionId, table.groupId],
      foreignColumns: [
        competitionRuleVersions.id,
        competitionRuleVersions.competitionId,
        competitionRuleVersions.groupId
      ]
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tournamentMatchId, table.groupId],
      foreignColumns: [tournamentMatches.id, tournamentMatches.groupId]
    }).onDelete("restrict"),
    unique("games_id_group_unique").on(table.id, table.groupId),
    check(
      "games_non_draw_has_different_scores",
      sql`(${table.outcome} = 'DRAW' and ${table.comparableScoreA} = ${table.comparableScoreB}) or (${table.outcome} <> 'DRAW' and ${table.comparableScoreA} <> ${table.comparableScoreB})`
    ),
    index("games_ranking_idx").on(
      table.groupId,
      table.competitionId,
      table.formatId,
      table.playedAt
    ),
    index("games_tournament_match_idx").on(table.tournamentMatchId)
  ]
);

export const gameParticipants = pgTable(
  "game_participants",
  {
    gameId: uuid("game_id").notNull(),
    groupId: uuid("group_id").notNull(),
    playerId: uuid("player_id").notNull(),
    side: gameSide("side").notNull(),
    slot: integer("slot").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.playerId] }),
    foreignKey({
      columns: [table.gameId, table.groupId],
      foreignColumns: [games.id, games.groupId]
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.playerId, table.groupId],
      foreignColumns: [players.id, players.groupId]
    }).onDelete("restrict"),
    unique("game_participant_side_slot_unique").on(
      table.gameId,
      table.side,
      table.slot
    ),
    check("game_participant_slot_nonnegative", sql`${table.slot} >= 0`)
  ]
);

export const gameRevisions = pgTable(
  "game_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull(),
    groupId: uuid("group_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    action: revisionAction("action").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.gameId, table.groupId],
      foreignColumns: [games.id, games.groupId]
    }).onDelete("restrict"),
    index("game_revisions_game_idx").on(table.gameId, table.createdAt)
  ]
);

export type Profile = typeof profiles.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Player = typeof players.$inferSelect;
export type GroupCompetition = typeof groupCompetitions.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
