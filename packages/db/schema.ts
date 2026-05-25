import { boolean, decimal, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  timezone: text("timezone").notNull(),
  preferredCurrency: text("preferred_currency").default("USD").notNull(),
  monthlyAiBudget: decimal("monthly_ai_budget"),
  ...timestamps
});

export const providerRegistry = pgTable("provider_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: text("provider_id").unique().notNull(),
  providerName: text("provider_name").notNull(),
  connectorType: text("connector_type").notNull(),
  connectorStatus: text("connector_status").notNull(),
  websiteUrl: text("website_url"),
  apiDocsUrl: text("api_docs_url"),
  pricingUrl: text("pricing_url"),
  supportsAccountUsageApi: boolean("supports_account_usage_api").default(false).notNull(),
  supportsResponseUsageMetadata: boolean("supports_response_usage_metadata").default(false).notNull(),
  supportsCreditBalanceApi: boolean("supports_credit_balance_api").default(false).notNull(),
  supportsManualImport: boolean("supports_manual_import").default(false).notNull(),
  supportsCsvImport: boolean("supports_csv_import").default(false).notNull(),
  supportsJsonImport: boolean("supports_json_import").default(false).notNull(),
  knownLimitations: jsonb("known_limitations").default({}).notNull(),
  priority: integer("priority").default(5).notNull(),
  ...timestamps
});

export const providerAccounts = pgTable("provider_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  providerId: text("provider_id").references(() => providerRegistry.providerId).notNull(),
  displayName: text("display_name").notNull(),
  authType: text("auth_type").notNull(),
  encryptedCredentials: text("encrypted_credentials"),
  planName: text("plan_name"),
  billingCurrency: text("billing_currency"),
  billingCycleStart: timestamp("billing_cycle_start", { withTimezone: true }),
  billingCycleEnd: timestamp("billing_cycle_end", { withTimezone: true }),
  resetRule: text("reset_rule"),
  monthlyBudget: decimal("monthly_budget"),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncStatus: text("sync_status").default("idle").notNull(),
  ...timestamps
});

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id).notNull(),
  providerId: text("provider_id").notNull(),
  modelId: text("model_id"),
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cachedTokens: integer("cached_tokens"),
  reasoningTokens: integer("reasoning_tokens"),
  imageUnits: decimal("image_units"),
  audioUnits: decimal("audio_units"),
  totalTokens: integer("total_tokens"),
  requestCount: integer("request_count"),
  messageCount: integer("message_count"),
  costAmount: decimal("cost_amount"),
  costCurrency: text("cost_currency"),
  confidence: text("confidence").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull()
});

export const usageCaps = pgTable("usage_caps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id).notNull(),
  capType: text("cap_type").notNull(),
  capLabel: text("cap_label").notNull(),
  capAmount: decimal("cap_amount").notNull(),
  capUnit: text("cap_unit").notNull(),
  usedAmount: decimal("used_amount").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  resetCadence: text("reset_cadence"),
  confidence: text("confidence").notNull(),
  ...timestamps
});

export const pricingSnapshots = pgTable("pricing_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: text("provider_id").notNull(),
  modelId: text("model_id").notNull(),
  modelDisplayName: text("model_display_name").notNull(),
  inputPricePer1mTokensUsd: decimal("input_price_per_1m_tokens_usd"),
  outputPricePer1mTokensUsd: decimal("output_price_per_1m_tokens_usd"),
  cachedInputPricePer1mTokensUsd: decimal("cached_input_price_per_1m_tokens_usd"),
  reasoningPricePer1mTokensUsd: decimal("reasoning_price_per_1m_tokens_usd"),
  imagePriceUnit: text("image_price_unit"),
  imagePriceUsd: decimal("image_price_usd"),
  audioPriceUnit: text("audio_price_unit"),
  audioPriceUsd: decimal("audio_price_usd"),
  contextWindow: integer("context_window"),
  sourceName: text("source_name").notNull(),
  sourceConfidence: text("source_confidence").notNull(),
  sourcePriority: integer("source_priority").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull()
});

export const modelBenchmarkSnapshots = pgTable("model_benchmark_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: text("provider_id").notNull(),
  modelId: text("model_id").notNull(),
  modelDisplayName: text("model_display_name").notNull(),
  sourceModelId: text("source_model_id"),
  sourceModelSlug: text("source_model_slug"),
  modelCreatorId: text("model_creator_id"),
  modelCreatorName: text("model_creator_name"),
  modelCreatorSlug: text("model_creator_slug"),
  evaluations: jsonb("evaluations").default({}).notNull(),
  pricing: jsonb("pricing").default({}).notNull(),
  artificialAnalysisIntelligenceIndex: decimal("artificial_analysis_intelligence_index"),
  artificialAnalysisCodingIndex: decimal("artificial_analysis_coding_index"),
  artificialAnalysisMathIndex: decimal("artificial_analysis_math_index"),
  mmluPro: decimal("mmlu_pro"),
  gpqa: decimal("gpqa"),
  hle: decimal("hle"),
  livecodebench: decimal("livecodebench"),
  scicode: decimal("scicode"),
  math500: decimal("math_500"),
  aime: decimal("aime"),
  medianOutputTokensPerSecond: decimal("median_output_tokens_per_second"),
  medianTimeToFirstTokenSeconds: decimal("median_time_to_first_token_seconds"),
  medianTimeToFirstAnswerTokenSeconds: decimal("median_time_to_first_answer_token_seconds"),
  sourceName: text("source_name").notNull(),
  sourceConfidence: text("source_confidence").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  isSnoozed: boolean("is_snoozed").default(false).notNull(),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id),
  importType: text("import_type").notNull(),
  fileName: text("file_name"),
  status: text("status").notNull(),
  rowsProcessed: integer("rows_processed").default(0).notNull(),
  rowsFailed: integer("rows_failed").default(0).notNull(),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});
