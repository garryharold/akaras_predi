CREATE TABLE `countries` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `countries_code_unique` ON `countries` (`code`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`region_id` text,
	`logo_url` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_short_name_unique` ON `leagues` (`short_name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`original_name` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_object_key_unique` ON `media` (`object_key`);--> statement-breakpoint
CREATE TABLE `player_nationalities` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`country_id` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nationality_pair` ON `player_nationalities` (`player_id`,`country_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`ign` text NOT NULL,
	`photo_url` text,
	`role_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regions_code_unique` ON `regions` (`code`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE TABLE `roster_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`player_id` text NOT NULL,
	`role_id` text NOT NULL,
	`is_starter` integer DEFAULT 1 NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "roster_dates_valid" CHECK("roster_memberships"."ended_at" IS NULL OR "roster_memberships"."ended_at" >= "roster_memberships"."started_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_team_per_player` ON `roster_memberships` (`player_id`) WHERE "roster_memberships"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_starter_per_role` ON `roster_memberships` (`team_id`,`role_id`) WHERE "roster_memberships"."ended_at" IS NULL AND "roster_memberships"."is_starter" = 1;--> statement-breakpoint
CREATE TABLE `team_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`alias` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_aliases_alias_unique` ON `team_aliases` (`alias`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`region_id` text,
	`league_id` text,
	`logo_url` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_short_name_unique` ON `teams` (`short_name`);