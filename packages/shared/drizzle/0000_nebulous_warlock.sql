CREATE TABLE "admin_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"flagged_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text NOT NULL,
	"value" text NOT NULL,
	"owner" text DEFAULT 'global' NOT NULL,
	CONSTRAINT "config_key_owner_pk" PRIMARY KEY("key","owner")
);
--> statement-breakpoint
CREATE TABLE "cv_result_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"tool_version" text DEFAULT 'unknown' NOT NULL,
	"cve_status" jsonb,
	"compat_status" jsonb,
	"pricing" jsonb,
	"eol_date" date,
	"license" text,
	"breaking_changes" jsonb,
	"regional_availability" jsonb,
	"source_url" text,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_seconds" integer DEFAULT 86400 NOT NULL,
	CONSTRAINT "cv_result_cache_tool_version_unique" UNIQUE("tool_name","tool_version")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manifest_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"category" text,
	"maturity_tier" text DEFAULT 'Emerging' NOT NULL,
	"confidence_score" integer DEFAULT 5 NOT NULL,
	"adoption_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"maintenance_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"platform_compat" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model_compat" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"owner" text DEFAULT 'global' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manifest_entries_tool_name_unique" UNIQUE("tool_name")
);
--> statement-breakpoint
CREATE TABLE "org_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_name" text NOT NULL,
	"tier" integer NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"maintenance_active" boolean DEFAULT true NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"owner" text DEFAULT 'global' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_list_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"action" text NOT NULL,
	"justification" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"second_pass_findings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"wave" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"output_jsonb" jsonb,
	"upstream_hashes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agent_version" text NOT NULL,
	"manifest_version" text NOT NULL,
	"context_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"tier" text NOT NULL,
	"verified_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified_context_hash" text NOT NULL,
	"wave0_domain_tag" text,
	"pass1_output" jsonb,
	"pass2_output" jsonb,
	"maturity_label_distribution" jsonb,
	"charged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"lifted_at" timestamp with time zone,
	"research_findings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"daily_run_count" integer DEFAULT 0 NOT NULL,
	"daily_run_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_relationship_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_name" text NOT NULL,
	"parent_org" text,
	"affiliates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_holds" ADD CONSTRAINT "admin_holds_org_id_org_list_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_list_proposals" ADD CONSTRAINT "org_list_proposals_org_id_org_list_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_checkpoints" ADD CONSTRAINT "run_checkpoints_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_holds" ADD CONSTRAINT "user_holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_holds" ADD CONSTRAINT "user_holds_org_id_org_list_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manifest_entries_tier_platform_idx" ON "manifest_entries" USING btree ("maturity_tier","platform_compat");--> statement-breakpoint
CREATE INDEX "run_checkpoints_reuse_idx" ON "run_checkpoints" USING btree ("context_hash","agent_name","agent_version","manifest_version");--> statement-breakpoint
CREATE INDEX "runs_user_id_created_at_idx" ON "runs" USING btree ("user_id","created_at");