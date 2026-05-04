CREATE TABLE "manifest_proposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tool_name" text NOT NULL,
	"proposed_entry" jsonb NOT NULL,
	"proposing_agent" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"gatekeeper_findings" jsonb,
	"cycle_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_holds" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "cv_result_cache" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "org_list" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "org_list_proposals" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "run_checkpoints" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_holds" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vendor_relationship_cache" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "manifest_tools" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "manifest_patterns" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "manifest_failure_modes" ALTER COLUMN "id" DROP DEFAULT;