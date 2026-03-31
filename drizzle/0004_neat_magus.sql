ALTER TABLE "torrents" ADD COLUMN "crawl_status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "torrents" ADD COLUMN "last_announce_at" timestamp;