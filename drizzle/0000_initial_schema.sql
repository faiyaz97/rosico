CREATE TYPE "public"."game_outcome" AS ENUM('A', 'B', 'DRAW');--> statement-breakpoint
CREATE TYPE "public"."game_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."revision_action" AS ENUM('CREATE', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."score_type" AS ENUM('NUMERIC', 'ORDERED');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tournament_type" AS ENUM('ELIMINATION', 'LEAGUE');--> statement-breakpoint
CREATE TYPE "public"."winner_direction" AS ENUM('HIGHER_WINS', 'LOWER_WINS');--> statement-breakpoint
CREATE TABLE "catalogue_competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"image_path" text,
	"default_configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_competitions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "catalogue_name_not_blank" CHECK (btrim("catalogue_competitions"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "competition_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"label" text NOT NULL,
	"players_per_side" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_formats_id_scope_unique" UNIQUE("id","competition_id","group_id"),
	CONSTRAINT "competition_formats_label_not_blank" CHECK (btrim("competition_formats"."label") <> ''),
	CONSTRAINT "competition_formats_team_size_positive" CHECK ("competition_formats"."players_per_side" > 0)
);
--> statement-breakpoint
CREATE TABLE "competition_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"allows_draws" boolean DEFAULT false NOT NULL,
	"score_type" "score_type" NOT NULL,
	"winner_direction" "winner_direction" DEFAULT 'HIGHER_WINS' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_rule_version_unique" UNIQUE("competition_id","version"),
	CONSTRAINT "competition_rules_id_scope_unique" UNIQUE("id","competition_id","group_id"),
	CONSTRAINT "competition_rule_version_positive" CHECK ("competition_rule_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"game_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side" "game_side" NOT NULL,
	"slot" integer NOT NULL,
	CONSTRAINT "game_participants_game_id_player_id_pk" PRIMARY KEY("game_id","player_id"),
	CONSTRAINT "game_participant_side_slot_unique" UNIQUE("game_id","side","slot"),
	CONSTRAINT "game_participant_slot_nonnegative" CHECK ("game_participants"."slot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "revision_action" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"tournament_match_id" uuid,
	"score_a" text NOT NULL,
	"score_b" text NOT NULL,
	"comparable_score_a" numeric(18, 6) NOT NULL,
	"comparable_score_b" numeric(18, 6) NOT NULL,
	"outcome" "game_outcome" NOT NULL,
	"score_difference" numeric(18, 6) NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location" text,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "games_id_group_unique" UNIQUE("id","group_id"),
	CONSTRAINT "games_non_draw_has_different_scores" CHECK (("games"."outcome" = 'DRAW' and "games"."comparable_score_a" = "games"."comparable_score_b") or ("games"."outcome" <> 'DRAW' and "games"."comparable_score_a" <> "games"."comparable_score_b"))
);
--> statement-breakpoint
CREATE TABLE "group_competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"catalogue_competition_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"image_path" text,
	"current_rule_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_competitions_id_group_unique" UNIQUE("id","group_id"),
	CONSTRAINT "group_competitions_name_not_blank" CHECK (btrim("group_competitions"."name") <> ''),
	CONSTRAINT "group_competitions_rule_version_positive" CHECK ("group_competitions"."current_rule_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"accepted_by_id" uuid,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "group_invitations_email_normalized" CHECK ("group_invitations"."email" = lower(btrim("group_invitations"."email")))
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_memberships_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_path" text,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_not_blank" CHECK (btrim("groups"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "ordered_score_values" (
	"rule_version_id" uuid NOT NULL,
	"value" text NOT NULL,
	"ordinal" integer NOT NULL,
	CONSTRAINT "ordered_score_values_rule_version_id_ordinal_pk" PRIMARY KEY("rule_version_id","ordinal"),
	CONSTRAINT "ordered_score_value_unique" UNIQUE("rule_version_id","value"),
	CONSTRAINT "ordered_score_value_not_blank" CHECK (btrim("ordered_score_values"."value") <> ''),
	CONSTRAINT "ordered_score_ordinal_nonnegative" CHECK ("ordered_score_values"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"image_path" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_id_group_unique" UNIQUE("id","group_id"),
	CONSTRAINT "players_display_name_not_blank" CHECK (btrim("players"."display_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"image_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_not_blank" CHECK (btrim("profiles"."display_name") <> ''),
	CONSTRAINT "profiles_email_normalized" CHECK ("profiles"."email" = lower(btrim("profiles"."email")))
);
--> statement-breakpoint
CREATE TABLE "tournament_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"seed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entries_id_scope_unique" UNIQUE("id","tournament_id","group_id"),
	CONSTRAINT "tournament_entries_seed_unique" UNIQUE("tournament_id","seed"),
	CONSTRAINT "tournament_entries_name_not_blank" CHECK (btrim("tournament_entries"."name") <> ''),
	CONSTRAINT "tournament_entries_seed_positive" CHECK ("tournament_entries"."seed" > 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_entry_players" (
	"entry_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	CONSTRAINT "tournament_entry_players_entry_id_player_id_pk" PRIMARY KEY("entry_id","player_id"),
	CONSTRAINT "tournament_player_once_unique" UNIQUE("tournament_id","player_id"),
	CONSTRAINT "tournament_entry_slot_unique" UNIQUE("entry_id","slot"),
	CONSTRAINT "tournament_entry_slot_nonnegative" CHECK ("tournament_entry_players"."slot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"slot" integer NOT NULL,
	"side_a_entry_id" uuid,
	"side_b_entry_id" uuid,
	"side_a_wins" integer DEFAULT 0 NOT NULL,
	"side_b_wins" integer DEFAULT 0 NOT NULL,
	"winner_entry_id" uuid,
	"next_match_id" uuid,
	"next_match_side" "game_side",
	"status" "match_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_match_round_slot_unique" UNIQUE("tournament_id","round","slot"),
	CONSTRAINT "tournament_matches_id_scope_unique" UNIQUE("id","tournament_id","group_id"),
	CONSTRAINT "tournament_match_round_positive" CHECK ("tournament_matches"."round" > 0),
	CONSTRAINT "tournament_match_slot_nonnegative" CHECK ("tournament_matches"."slot" >= 0),
	CONSTRAINT "tournament_match_wins_nonnegative" CHECK ("tournament_matches"."side_a_wins" >= 0 and "tournament_matches"."side_b_wins" >= 0),
	CONSTRAINT "tournament_match_distinct_sides" CHECK ("tournament_matches"."side_a_entry_id" is null or "tournament_matches"."side_b_entry_id" is null or "tournament_matches"."side_a_entry_id" <> "tournament_matches"."side_b_entry_id")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_path" text,
	"type" "tournament_type" NOT NULL,
	"status" "tournament_status" DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"best_of" integer,
	"win_points" integer,
	"draw_points" integer,
	"loss_points" integer,
	"winner_entry_id" uuid,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_id_scope_unique" UNIQUE("id","group_id"),
	CONSTRAINT "tournaments_name_not_blank" CHECK (btrim("tournaments"."name") <> ''),
	CONSTRAINT "tournaments_best_of_valid" CHECK ("tournaments"."best_of" is null or ("tournaments"."best_of" > 0 and "tournaments"."best_of" <= 99 and "tournaments"."best_of" % 2 = 1)),
	CONSTRAINT "tournaments_type_settings_valid" CHECK (("tournaments"."type" = 'ELIMINATION' and "tournaments"."best_of" is not null and "tournaments"."win_points" is null and "tournaments"."draw_points" is null and "tournaments"."loss_points" is null) or ("tournaments"."type" = 'LEAGUE' and "tournaments"."best_of" is null and "tournaments"."win_points" is not null and "tournaments"."loss_points" is not null)),
	CONSTRAINT "tournaments_dates_valid" CHECK ("tournaments"."ends_at" is null or "tournaments"."ends_at" >= "tournaments"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "competition_formats" ADD CONSTRAINT "competition_formats_competition_id_group_id_group_competitions_id_group_id_fk" FOREIGN KEY ("competition_id","group_id") REFERENCES "public"."group_competitions"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rule_versions" ADD CONSTRAINT "competition_rule_versions_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rule_versions" ADD CONSTRAINT "competition_rule_versions_competition_id_group_id_group_competitions_id_group_id_fk" FOREIGN KEY ("competition_id","group_id") REFERENCES "public"."group_competitions"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_group_id_games_id_group_id_fk" FOREIGN KEY ("game_id","group_id") REFERENCES "public"."games"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_player_id_group_id_players_id_group_id_fk" FOREIGN KEY ("player_id","group_id") REFERENCES "public"."players"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_revisions" ADD CONSTRAINT "game_revisions_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_revisions" ADD CONSTRAINT "game_revisions_game_id_group_id_games_id_group_id_fk" FOREIGN KEY ("game_id","group_id") REFERENCES "public"."games"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_updated_by_id_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_deleted_by_id_profiles_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_competition_id_group_id_group_competitions_id_group_id_fk" FOREIGN KEY ("competition_id","group_id") REFERENCES "public"."group_competitions"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_format_id_competition_id_group_id_competition_formats_id_competition_id_group_id_fk" FOREIGN KEY ("format_id","competition_id","group_id") REFERENCES "public"."competition_formats"("id","competition_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_rule_version_id_competition_id_group_id_competition_rule_versions_id_competition_id_group_id_fk" FOREIGN KEY ("rule_version_id","competition_id","group_id") REFERENCES "public"."competition_rule_versions"("id","competition_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_competitions" ADD CONSTRAINT "group_competitions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_competitions" ADD CONSTRAINT "group_competitions_catalogue_competition_id_catalogue_competitions_id_fk" FOREIGN KEY ("catalogue_competition_id") REFERENCES "public"."catalogue_competitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invited_by_id_profiles_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_accepted_by_id_profiles_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_added_by_id_profiles_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordered_score_values" ADD CONSTRAINT "ordered_score_values_rule_version_id_competition_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."competition_rule_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournament_id_group_id_tournaments_id_group_id_fk" FOREIGN KEY ("tournament_id","group_id") REFERENCES "public"."tournaments"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_players" ADD CONSTRAINT "tournament_entry_players_entry_id_tournament_id_group_id_tournament_entries_id_tournament_id_group_id_fk" FOREIGN KEY ("entry_id","tournament_id","group_id") REFERENCES "public"."tournament_entries"("id","tournament_id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_players" ADD CONSTRAINT "tournament_entry_players_player_id_group_id_players_id_group_id_fk" FOREIGN KEY ("player_id","group_id") REFERENCES "public"."players"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_group_id_tournaments_id_group_id_fk" FOREIGN KEY ("tournament_id","group_id") REFERENCES "public"."tournaments"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_competition_id_group_id_group_competitions_id_group_id_fk" FOREIGN KEY ("competition_id","group_id") REFERENCES "public"."group_competitions"("id","group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_format_id_competition_id_group_id_competition_formats_id_competition_id_group_id_fk" FOREIGN KEY ("format_id","competition_id","group_id") REFERENCES "public"."competition_formats"("id","competition_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_rule_version_id_competition_id_group_id_competition_rule_versions_id_competition_id_group_id_fk" FOREIGN KEY ("rule_version_id","competition_id","group_id") REFERENCES "public"."competition_rule_versions"("id","competition_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_formats_competition_idx" ON "competition_formats" USING btree ("competition_id","archived_at");--> statement-breakpoint
CREATE INDEX "competition_rules_group_idx" ON "competition_rule_versions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "game_revisions_game_idx" ON "game_revisions" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE INDEX "games_ranking_idx" ON "games" USING btree ("group_id","competition_id","format_id","played_at");--> statement-breakpoint
CREATE INDEX "games_tournament_match_idx" ON "games" USING btree ("tournament_match_id");--> statement-breakpoint
CREATE INDEX "group_competitions_group_active_idx" ON "group_competitions" USING btree ("group_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_invitations_pending_unique" ON "group_invitations" USING btree ("group_id",lower("email")) WHERE "group_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "group_invitations_email_idx" ON "group_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "group_memberships_user_idx" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "groups_creator_idx" ON "groups" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "players_group_active_idx" ON "players" USING btree ("group_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_normalized_unique" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "tournament_matches_tournament_idx" ON "tournament_matches" USING btree ("tournament_id","round");--> statement-breakpoint
CREATE INDEX "tournaments_group_status_idx" ON "tournaments" USING btree ("group_id","status");
