ALTER TABLE "users" ALTER COLUMN "image" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "peers" ADD COLUMN "country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "peers" ADD COLUMN "country_name" varchar(100);--> statement-breakpoint
ALTER TABLE "peers" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "peers" ADD COLUMN "lon" double precision;