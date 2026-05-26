import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insertModelBenchmarkSnapshots, insertPricingSnapshots } from "@knut/db";
import { fetchArtificialAnalysisPricingAndBenchmarks, fetchLiteLlmPricing, fetchModelsDevPricing, fetchOpenRouterPricing, normalisePricing, type ArtificialAnalysisBenchmark, type RawPrice } from "@knut/pricing";
import { handleModelsRequest } from "../../apiUtils/models";

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

async function settleArtificialAnalysis(fetchedAt: string): Promise<{
  name: string;
  rows: RawPrice[];
  benchmarks: ArtificialAnalysisBenchmark[];
  fetchedRows: number;
  error: string | null;
}> {
  try {
    const result = await fetchArtificialAnalysisPricingAndBenchmarks(undefined, fetchedAt);
    return {
      name: "Artificial Analysis",
      rows: result.prices.slice(0, maxRowsPerSource),
      benchmarks: result.benchmarks,
      fetchedRows: result.prices.length,
      error: null
    };
  } catch (error) {
    return {
      name: "Artificial Analysis",
      rows: [],
      benchmarks: [],
      fetchedRows: 0,
      error: error instanceof Error ? error.message : "Unknown Artificial Analysis fetch error"
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.query.action === "models") {
      return handleModelsRequest(req, res);
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const refreshSecret = process.env.PRICING_REFRESH_SECRET;
    if (refreshSecret && req.headers["x-knut-job-secret"] !== refreshSecret) {
      return res.status(401).json({ error: "Unauthorized pricing refresh." });
    }

    const fetchedAt = new Date().toISOString();
    const [artificialAnalysisResult, ...results] = await Promise.all([
      settleArtificialAnalysis(fetchedAt),
      settleSource("Models.dev", fetchModelsDevPricing),
      settleSource("LiteLLM", fetchLiteLlmPricing),
      settleSource("OpenRouter", fetchOpenRouterPricing)
    ]);

    const allResults = [artificialAnalysisResult, ...results];
    const snapshots = normalisePricing(allResults.flatMap((result) => result.rows), fetchedAt);
    const persisted = await insertPricingSnapshots(snapshots);
    const persistedBenchmarks = await insertModelBenchmarkSnapshots(artificialAnalysisResult.benchmarks);

    return res.status(200).json({
      ok: true,
      snapshots: snapshots.length,
      inserted: persisted.inserted,
      benchmarkSnapshots: artificialAnalysisResult.benchmarks.length,
      benchmarkSnapshotsInserted: persistedBenchmarks.inserted,
      capPerSource: maxRowsPerSource,
      sources: allResults.map((result) => ({
        name: result.name,
        fetchedRows: result.fetchedRows,
        storedRows: result.rows.length,
        benchmarkRows: "benchmarks" in result ? result.benchmarks.length : 0,
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
