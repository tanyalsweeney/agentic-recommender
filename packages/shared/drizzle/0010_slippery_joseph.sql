CREATE TABLE "codebase_digest_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"digest" jsonb NOT NULL,
	"quality_summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manifest_intent_gap_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"question_text" text NOT NULL,
	"option_type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_when" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"vetted" boolean DEFAULT false NOT NULL,
	"owner" text DEFAULT 'global' NOT NULL,
	CONSTRAINT "manifest_intent_gap_questions_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_communication_contexts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prompt_fragment" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_modification_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"intent_description" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"quoted_amount" text,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codebase_digest_drafts" ADD CONSTRAINT "codebase_digest_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codebase_digest_drafts" ADD CONSTRAINT "codebase_digest_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_communication_contexts" ADD CONSTRAINT "tenant_communication_contexts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modification_requests" ADD CONSTRAINT "tenant_modification_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;