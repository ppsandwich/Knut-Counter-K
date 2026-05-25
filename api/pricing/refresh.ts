import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insertPricingSnapshots } from "@knut/db";
import { fetchLiteLlmPricing, fetchModelsDevPricing, fetchOpenRouterPricing, normalisePricing, type RawPrice } from "@knut/pricing";

const maxRowsPerSource = 750;

async function settleSource(name: string, fetcher: () => Promise<RawPrice[]>) {
  try {
    const rows = await fetcher();
    return { name, rows: rows.slice(0, maxRowsPerSource), fetchedRows: rows.length, error: null };
  } catch (error) {
    return {
      name,
      rows: [],
      fetchedRows: 0,
      error: error instanceof Error ? error.message : "Unknown pricing fetch error"
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const refreshSecret = process.env.PRICING_REFRESH_SECRET;
    if (refreshSecret && req.headers["x-knut-job-secret"] !== refreshSecret) {
      return res.status(401).json({ error: "Unauthorized pricing refresh." });
    }

    const fetchedAt = new Date().toISOString();
    const results = await Promise.all([
      settleSource("Models.dev", fetchModelsDevPricing),
      settleSource("LiteLLM", fetchLiteLlmPricing),
      settleSource("OpenRouter", fetchOpenRouterPricing)
    ]);

    const snapshots = normalisePricing(results.flatMap((result) => result.rows), fetchedAt);
    const persisted = await insertPricingSnapshots(snapshots);

    return res.status(200).json({
      ok: true,
      snapshots: snapshots.length,
      inserted: persisted.inserted,
      capPerSource: maxRowsPerSource,
      sources: results.map((result) => ({
        name: result.name,
        fetchedRows: result.fetchedRows,
        storedRows: result.rows.length,
        error: result.error
      }))
    });
  } catch (error) {
    console.error("Pricing refresh failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Pricing refresh failed"
    });
  }
}
