CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" uuid,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_snoozed" boolean DEFAULT false NOT NULL,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" uuid,
	"import_type" text NOT NULL,
	"file_name" text,
	"status" text NOT NULL,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pricing_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"model_display_name" text NOT NULL,
	"input_price_per_1m_tokens_usd" numeric,
	"output_price_per_1m_tokens_usd" numeric,
	"cached_input_price_per_1m_tokens_usd" numeric,
	"reasoning_price_per_1m_tokens_usd" numeric,
	"image_price_unit" text,
	"image_price_usd" numeric,
	"audio_price_unit" text,
	"audio_price_usd" numeric,
	"context_window" integer,
	"source_name" text NOT NULL,
	"source_confidence" text NOT NULL,
	"source_priority" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"effective_from" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"display_name" text NOT NULL,
	"auth_type" text NOT NULL,
	"encrypted_credentials" text,
	"plan_name" text,
	"billing_currency" text,
	"billing_cycle_start" timestamp with time zone,
	"billing_cycle_end" timestamp with time zone,
	"reset_rule" text,
	"monthly_budget" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"connector_type" text NOT NULL,
	"connector_status" text NOT NULL,
	"website_url" text,
	"api_docs_url" text,
	"pricing_url" text,
	"supports_account_usage_api" boolean DEFAULT false NOT NULL,
	"supports_response_usage_metadata" boolean DEFAULT false NOT NULL,
	"supports_credit_balance_api" boolean DEFAULT false NOT NULL,
	"supports_manual_import" boolean DEFAULT false NOT NULL,
	"supports_csv_import" boolean DEFAULT false NOT NULL,
	"supports_json_import" boolean DEFAULT false NOT NULL,
	"known_limitations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_registry_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "usage_caps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"cap_type" text NOT NULL,
	"cap_label" text NOT NULL,
	"cap_amount" numeric NOT NULL,
	"cap_unit" text NOT NULL,
	"used_amount" numeric NOT NULL,
	"reset_at" timestamp with time zone,
	"reset_cadence" text,
	"confidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"model_id" text,
	"source_type" text NOT NULL,
	"source_ref" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"reasoning_tokens" integer,
	"image_units" numeric,
	"audio_units" numeric,
	"total_tokens" integer,
	"request_count" integer,
	"message_count" integer,
	"cost_amount" numeric,
	"cost_currency" text,
	"confidence" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"timezone" text NOT NULL,
	"preferred_currency" text DEFAULT 'USD' NOT NULL,
	"monthly_ai_budget" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_provider_id_provider_registry_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_registry"("provider_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_caps" ADD CONSTRAINT "usage_caps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_caps" ADD CONSTRAINT "usage_caps_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;