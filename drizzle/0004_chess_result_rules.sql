UPDATE "catalogue_competitions"
SET "default_configuration" = jsonb_set(
  "default_configuration",
  '{scoreType}',
  '"RESULT"'::jsonb,
  true
)
WHERE "slug" = 'chess';

WITH chess_catalogue AS (
  SELECT "id"
  FROM "catalogue_competitions"
  WHERE "slug" = 'chess'
), migrated_rules AS (
  INSERT INTO "competition_rule_versions" (
    "competition_id",
    "group_id",
    "version",
    "allows_draws",
    "score_type",
    "winner_direction",
    "created_by_id"
  )
  SELECT
    competition."id",
    competition."group_id",
    competition."current_rule_version" + 1,
    true,
    'RESULT',
    'HIGHER_WINS',
    current_rule."created_by_id"
  FROM "group_competitions" AS competition
  INNER JOIN chess_catalogue
    ON chess_catalogue."id" = competition."catalogue_competition_id"
  INNER JOIN "competition_rule_versions" AS current_rule
    ON current_rule."competition_id" = competition."id"
    AND current_rule."group_id" = competition."group_id"
    AND current_rule."version" = competition."current_rule_version"
  WHERE current_rule."score_type" <> 'RESULT'
  RETURNING "competition_id", "group_id", "version"
)
UPDATE "group_competitions" AS competition
SET
  "current_rule_version" = migrated_rules."version",
  "updated_at" = now()
FROM migrated_rules
WHERE competition."id" = migrated_rules."competition_id"
  AND competition."group_id" = migrated_rules."group_id";
