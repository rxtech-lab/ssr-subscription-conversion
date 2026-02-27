CREATE TABLE `proxy_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`members` text,
	`settings` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`value` text,
	`target` text NOT NULL,
	`comment` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`server` text,
	`port` integer,
	`encrypted_settings` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscription_links` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_links_token_unique` ON `subscription_links` (`token`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`general_config` text,
	`created_at` integer,
	`updated_at` integer
);
