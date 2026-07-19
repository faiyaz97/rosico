ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_id_group_unique" UNIQUE("id","group_id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_match_id_group_id_tournament_matches_id_group_id_fk" FOREIGN KEY ("tournament_match_id","group_id") REFERENCES "public"."tournament_matches"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_side_a_entry_id_tournament_id_group_id_tournament_entries_id_tournament_id_group_id_fk" FOREIGN KEY ("side_a_entry_id","tournament_id","group_id") REFERENCES "public"."tournament_entries"("id","tournament_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_side_b_entry_id_tournament_id_group_id_tournament_entries_id_tournament_id_group_id_fk" FOREIGN KEY ("side_b_entry_id","tournament_id","group_id") REFERENCES "public"."tournament_entries"("id","tournament_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_entry_id_tournament_id_group_id_tournament_entries_id_tournament_id_group_id_fk" FOREIGN KEY ("winner_entry_id","tournament_id","group_id") REFERENCES "public"."tournament_entries"("id","tournament_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_entry_scope_fk" FOREIGN KEY ("winner_entry_id","id","group_id") REFERENCES "public"."tournament_entries"("id","tournament_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_match_scope_fk" FOREIGN KEY ("next_match_id","tournament_id","group_id") REFERENCES "public"."tournament_matches"("id","tournament_id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_state_consistent" CHECK (
  ("status" = 'PENDING' AND "accepted_by_id" IS NULL AND "accepted_at" IS NULL AND "cancelled_at" IS NULL)
  OR ("status" = 'ACCEPTED' AND "accepted_by_id" IS NOT NULL AND "accepted_at" IS NOT NULL AND "cancelled_at" IS NULL)
  OR ("status" = 'CANCELLED' AND "accepted_by_id" IS NULL AND "accepted_at" IS NULL AND "cancelled_at" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_score_difference_consistent" CHECK (
  "score_difference" = "comparable_score_a" - "comparable_score_b"
);--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_is_side" CHECK (
  "winner_entry_id" IS NULL
  OR "winner_entry_id" = "side_a_entry_id"
  OR "winner_entry_id" = "side_b_entry_id"
);--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS "private";--> statement-breakpoint
REVOKE ALL ON SCHEMA "private" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "private"."reject_immutable_rule_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'competition rule versions and ordered values are immutable';
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."reject_immutable_rule_mutation"() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER "competition_rule_versions_immutable"
BEFORE UPDATE OR DELETE ON "competition_rule_versions"
FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_rule_mutation"();--> statement-breakpoint
CREATE TRIGGER "ordered_score_values_immutable"
BEFORE UPDATE OR DELETE ON "ordered_score_values"
FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_rule_mutation"();--> statement-breakpoint

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalogue_competitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_competitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competition_rule_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ordered_score_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competition_formats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_entry_players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON TABLE
  "profiles",
  "groups",
  "group_memberships",
  "group_invitations",
  "players",
  "catalogue_competitions",
  "group_competitions",
  "competition_rule_versions",
  "ordered_score_values",
  "competition_formats",
  "games",
  "game_participants",
  "game_revisions",
  "tournaments",
  "tournament_entries",
  "tournament_entry_players",
  "tournament_matches"
FROM anon, authenticated;--> statement-breakpoint

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
