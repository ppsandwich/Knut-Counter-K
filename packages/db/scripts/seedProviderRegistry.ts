import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { getDb } from "../client";
import { providerRegistry } from "../schema";

type RegistryFile = {
  providers: Array<{
    provider_id: string;
    name: string;
    connector_type: string;
    connector_status: string;
    website_url?: string;
    api_docs_url?: string;
    pricing_url?: string;
    supports_account_usage_api?: boolean;
    supports_response_usage_metadata?: boolean;
    supports_credit_balance_api?: boolean;
    supports_manual_import?: boolean;
    supports_csv_import?: boolean;
    supports_json_import?: boolean;
    known_limitations?: Record<string, unknown>;
    priority?: number;
  }>;
};

const registryPath = resolve(process.cwd(), "../providers/registry/provider_registry.yml");
const file = YAML.parse(readFileSync(registryPath, "utf8")) as RegistryFile;

async function main() {
  const db = getDb();

  for (const provider of file.providers) {
    await db
      .insert(providerRegistry)
      .values({
        providerId: provider.provider_id,
        providerName: provider.name,
        connectorType: provider.connector_type,
        connectorStatus: provider.connector_status,
        websiteUrl: provider.website_url ?? null,
        apiDocsUrl: provider.api_docs_url ?? null,
        pricingUrl: provider.pricing_url ?? null,
        supportsAccountUsageApi: Boolean(provider.supports_account_usage_api),
        supportsResponseUsageMetadata: Boolean(provider.supports_response_usage_metadata),
        supportsCreditBalanceApi: Boolean(provider.supports_credit_balance_api),
        supportsManualImport: Boolean(provider.supports_manual_import),
        supportsCsvImport: Boolean(provider.supports_csv_import),
        supportsJsonImport: Boolean(provider.supports_json_import),
        knownLimitations: provider.known_limitations ?? {},
        priority: provider.priority ?? 5
      })
      .onConflictDoUpdate({
        target: providerRegistry.providerId,
        set: {
          providerName: provider.name,
          connectorType: provider.connector_type,
          connectorStatus: provider.connector_status,
          websiteUrl: provider.website_url ?? null,
          apiDocsUrl: provider.api_docs_url ?? null,
          pricingUrl: provider.pricing_url ?? null,
          supportsAccountUsageApi: Boolean(provider.supports_account_usage_api),
          supportsResponseUsageMetadata: Boolean(provider.supports_response_usage_metadata),
          supportsCreditBalanceApi: Boolean(provider.supports_credit_balance_api),
          supportsManualImport: Boolean(provider.supports_manual_import),
          supportsCsvImport: Boolean(provider.supports_csv_import),
          supportsJsonImport: Boolean(provider.supports_json_import),
          knownLimitations: provider.known_limitations ?? {},
          priority: provider.priority ?? 5,
          updatedAt: new Date()
        }
      });
  }

  console.log(`Seeded ${file.providers.length} providers.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
