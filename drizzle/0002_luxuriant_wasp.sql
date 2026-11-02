ALTER TABLE `players` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `players` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `players` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `players` ADD `residency_region_id` text REFERENCES regions(id);--> statement-breakpoint
ALTER TABLE `players` ADD `source_label` text;--> statement-breakpoint
ALTER TABLE `roster_memberships` ADD `lineup_status` text;--> statement-breakpoint
ALTER TABLE `roster_memberships` ADD `start_date_is_observation` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_memberships` ADD `source_label` text;