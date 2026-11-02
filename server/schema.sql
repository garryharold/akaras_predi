-- Akarás Predictions: PostgreSQL schema, private akaras namespace.

-- Derived from drizzle migrations 0000–0004; applied once in a transaction.

CREATE TABLE "countries" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL
);

CREATE TABLE "leagues" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "short_name" text NOT NULL,
  "region_id" text,
  "logo_url" text,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "media" (
  "id" text PRIMARY KEY NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "original_name" text NOT NULL,
  "byte_size" integer NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "player_nationalities" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "country_id" text NOT NULL
);

CREATE TABLE "players" (
  "id" text PRIMARY KEY NOT NULL,
  "ign" text NOT NULL,
  "photo_url" text,
  "role_id" text,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "first_name" text,
  "last_name" text,
  "birth_date" text,
  "residency_region_id" text,
  "source_label" text
);

CREATE TABLE "regions" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE "roster_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "player_id" text NOT NULL,
  "role_id" text NOT NULL,
  "is_starter" integer NOT NULL DEFAULT 1,
  "started_at" text NOT NULL,
  "ended_at" text,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "lineup_status" text,
  "start_date_is_observation" integer NOT NULL DEFAULT 0,
  "source_label" text,
  CHECK ("roster_memberships"."ended_at" IS NULL OR "roster_memberships"."ended_at" >= "roster_memberships"."started_at")
);

CREATE TABLE "team_aliases" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "alias" text NOT NULL
);

CREATE TABLE "teams" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "short_name" text NOT NULL,
  "region_id" text,
  "league_id" text,
  "logo_url" text,
  "active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "match_players" (
  "id" text PRIMARY KEY NOT NULL,
  "match_id" text NOT NULL,
  "player_id" text NOT NULL,
  "team_id" text NOT NULL
);

CREATE TABLE "matches" (
  "id" text PRIMARY KEY NOT NULL,
  "phase_id" text NOT NULL,
  "group_id" text,
  "team_a_id" text NOT NULL,
  "team_b_id" text NOT NULL,
  "best_of" integer NOT NULL,
  "start_at" text NOT NULL,
  "prediction_lock_at" text NOT NULL,
  "round_name" text NOT NULL DEFAULT '',
  "round_order" integer NOT NULL DEFAULT 0,
  "bracket_side" text NOT NULL DEFAULT 'main',
  "status" text NOT NULL DEFAULT 'scheduled',
  "score_a" integer,
  "score_b" integer,
  "mvp_player_id" text,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  CHECK ("matches"."team_a_id" <> "matches"."team_b_id"),
  CHECK ("matches"."best_of" IN (1,3,5,7,9))
);

CREATE TABLE "phase_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "phase_id" text NOT NULL,
  "name" text NOT NULL
);

CREATE TABLE "phase_teams" (
  "id" text PRIMARY KEY NOT NULL,
  "phase_id" text NOT NULL,
  "team_id" text NOT NULL,
  "group_id" text
);

CREATE TABLE "phases" (
  "id" text PRIMARY KEY NOT NULL,
  "season_id" text NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "win_points" integer NOT NULL DEFAULT 1,
  "loss_points" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "prediction_users" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "avatar_url" text
);

CREATE TABLE "predictions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "match_id" text NOT NULL,
  "score_a" integer NOT NULL,
  "score_b" integer NOT NULL,
  "mvp_player_id" text,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "seasons" (
  "id" text PRIMARY KEY NOT NULL,
  "league_id" text NOT NULL,
  "year" integer NOT NULL,
  "name" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "bracket_plans" (
  "phase_id" text PRIMARY KEY NOT NULL,
  "nodes_json" text NOT NULL DEFAULT '[]',
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "auth_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "password_salt" text NOT NULL,
  "password_iterations" integer NOT NULL,
  "is_admin" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "updated_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "auth_attempts" (
  "key" text PRIMARY KEY NOT NULL,
  "attempts" integer NOT NULL,
  "window_start" bigint NOT NULL
);

CREATE TABLE "auth_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE "profile_images" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "created_at" text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

ALTER TABLE "leagues" ADD CONSTRAINT "leagues_fk_0" FOREIGN KEY ("region_id") REFERENCES "regions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "player_nationalities" ADD CONSTRAINT "player_nationalities_fk_0" FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "player_nationalities" ADD CONSTRAINT "player_nationalities_fk_1" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "players" ADD CONSTRAINT "players_fk_0" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "players" ADD CONSTRAINT "players_fk_1" FOREIGN KEY ("residency_region_id") REFERENCES "regions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_fk_0" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_fk_1" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_fk_2" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_fk_0" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "teams" ADD CONSTRAINT "teams_fk_0" FOREIGN KEY ("league_id") REFERENCES "leagues" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "teams" ADD CONSTRAINT "teams_fk_1" FOREIGN KEY ("region_id") REFERENCES "regions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "match_players" ADD CONSTRAINT "match_players_fk_0" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "match_players" ADD CONSTRAINT "match_players_fk_1" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "match_players" ADD CONSTRAINT "match_players_fk_2" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "matches" ADD CONSTRAINT "matches_fk_0" FOREIGN KEY ("mvp_player_id") REFERENCES "players" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "matches" ADD CONSTRAINT "matches_fk_1" FOREIGN KEY ("team_b_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "matches" ADD CONSTRAINT "matches_fk_2" FOREIGN KEY ("team_a_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "matches" ADD CONSTRAINT "matches_fk_3" FOREIGN KEY ("group_id") REFERENCES "phase_groups" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "matches" ADD CONSTRAINT "matches_fk_4" FOREIGN KEY ("phase_id") REFERENCES "phases" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "phase_groups" ADD CONSTRAINT "phase_groups_fk_0" FOREIGN KEY ("phase_id") REFERENCES "phases" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "phase_teams" ADD CONSTRAINT "phase_teams_fk_0" FOREIGN KEY ("group_id") REFERENCES "phase_groups" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "phase_teams" ADD CONSTRAINT "phase_teams_fk_1" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "phase_teams" ADD CONSTRAINT "phase_teams_fk_2" FOREIGN KEY ("phase_id") REFERENCES "phases" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "phases" ADD CONSTRAINT "phases_fk_0" FOREIGN KEY ("season_id") REFERENCES "seasons" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "predictions" ADD CONSTRAINT "predictions_fk_0" FOREIGN KEY ("mvp_player_id") REFERENCES "players" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "predictions" ADD CONSTRAINT "predictions_fk_1" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "predictions" ADD CONSTRAINT "predictions_fk_2" FOREIGN KEY ("user_id") REFERENCES "prediction_users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "seasons" ADD CONSTRAINT "seasons_fk_0" FOREIGN KEY ("league_id") REFERENCES "leagues" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "bracket_plans" ADD CONSTRAINT "bracket_plans_fk_0" FOREIGN KEY ("phase_id") REFERENCES "phases" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_fk_0" FOREIGN KEY ("user_id") REFERENCES "prediction_users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_fk_0" FOREIGN KEY ("account_id") REFERENCES "auth_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "profile_images" ADD CONSTRAINT "profile_images_fk_0" FOREIGN KEY ("user_id") REFERENCES "prediction_users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

CREATE UNIQUE INDEX "auth_accounts_email_unique" ON "auth_accounts" ("email");

CREATE UNIQUE INDEX "auth_accounts_user_id_unique" ON "auth_accounts" ("user_id");

CREATE UNIQUE INDEX "countries_code_unique" ON "countries" ("code");

CREATE UNIQUE INDEX "league_year_unique" ON "seasons" ("league_id","year");

CREATE UNIQUE INDEX "leagues_short_name_unique" ON "leagues" ("short_name");

CREATE UNIQUE INDEX "match_player_once" ON "match_players" ("match_id","player_id");

CREATE UNIQUE INDEX "media_object_key_unique" ON "media" ("object_key");

CREATE UNIQUE INDEX "nationality_pair" ON "player_nationalities" ("player_id","country_id");

CREATE UNIQUE INDEX "one_active_starter_per_role" ON "roster_memberships" ("team_id","role_id") WHERE "roster_memberships"."ended_at" IS NULL AND "roster_memberships"."is_starter" = 1;

CREATE UNIQUE INDEX "one_active_team_per_player" ON "roster_memberships" ("player_id") WHERE "roster_memberships"."ended_at" IS NULL;

CREATE UNIQUE INDEX "one_prediction_per_user_match" ON "predictions" ("user_id","match_id");

CREATE UNIQUE INDEX "phase_team_once" ON "phase_teams" ("phase_id","team_id");

CREATE UNIQUE INDEX "regions_code_unique" ON "regions" ("code");

CREATE UNIQUE INDEX "roles_code_unique" ON "roles" ("code");

CREATE UNIQUE INDEX "team_aliases_alias_unique" ON "team_aliases" ("alias");

CREATE UNIQUE INDEX "teams_short_name_unique" ON "teams" ("short_name");
