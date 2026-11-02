CREATE TABLE `match_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team_id` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_player_once` ON `match_players` (`match_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`group_id` text,
	`team_a_id` text NOT NULL,
	`team_b_id` text NOT NULL,
	`best_of` integer NOT NULL,
	`start_at` text NOT NULL,
	`prediction_lock_at` text NOT NULL,
	`round_name` text DEFAULT '' NOT NULL,
	`round_order` integer DEFAULT 0 NOT NULL,
	`bracket_side` text DEFAULT 'main' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`score_a` integer,
	`score_b` integer,
	`mvp_player_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `phases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `phase_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mvp_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "different_match_teams" CHECK("matches"."team_a_id" <> "matches"."team_b_id"),
	CONSTRAINT "valid_best_of" CHECK("matches"."best_of" IN (1,3,5,7,9))
);
--> statement-breakpoint
CREATE TABLE `phase_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `phases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `phase_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`team_id` text NOT NULL,
	`group_id` text,
	FOREIGN KEY (`phase_id`) REFERENCES `phases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `phase_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phase_team_once` ON `phase_teams` (`phase_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `phases` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`win_points` integer DEFAULT 1 NOT NULL,
	`loss_points` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prediction_users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`match_id` text NOT NULL,
	`score_a` integer NOT NULL,
	`score_b` integer NOT NULL,
	`mvp_player_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `prediction_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mvp_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_prediction_per_user_match` ON `predictions` (`user_id`,`match_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_year_unique` ON `seasons` (`league_id`,`year`);