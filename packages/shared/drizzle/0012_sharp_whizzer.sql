ALTER TABLE "users" RENAME COLUMN "auth_provider_id" TO "auth_provider_user_id";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "auth_provider_org_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_auth_provider_org_id_unique" UNIQUE("auth_provider","auth_provider_org_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_provider_user_id_unique" UNIQUE("auth_provider","auth_provider_user_id");