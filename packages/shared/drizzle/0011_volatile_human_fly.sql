ALTER TABLE "runs" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "auth_provider" text DEFAULT 'clerk' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" text DEFAULT 'clerk' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;