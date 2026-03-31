ALTER TABLE "torrents" ADD COLUMN "seeders" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "torrents" ADD COLUMN "leechers" integer DEFAULT 0 NOT NULL;