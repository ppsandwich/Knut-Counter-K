import { insertModelBenchmarkSnapshots, insertPricingSnapshots } from "@knut/db";
import {
  fetchArtificialAnalysisPricingAndBenchmarks,
  fetchLiteLlmPricing,
  fetchModelsDevPricing,
  fetchOpenRouterPricing,
  normalisePricing,
  type ArtificialAnalysisBenchmark,
  type RawPrice
} from "@knut/pricing";

const maxRowsPerSource = 750;

type SourceResult = {
  name: string;
  rows: RawPrice[];
  fetchedRows: number;
  error: string | null;
};

type ArtificialAnalysisResult = SourceResult & {
  benchmarks: ArtificialAnalysisBenchmark[];
};

function isArtificialAnalysisResult(result: SourceResult | ArtificialAnalysisResult): result is ArtificialAnalysisResult {
  return "benchmarks" in result;
}

async function settleSource(name: string, fetcher: () => Promise<RawPrice[]>): Promise<SourceResult> {
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

async function settleArtificialAnalysis(fetchedAt: string): Promise<ArtificialAnalysisResult> {
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

export async function refreshModelData() {
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

  return {
    fetchedAt,
    snapshots: snapshots.length,
    inserted: persisted.inserted,
    benchmarkSnapshots: artificialAnalysisResult.benchmarks.length,
    benchmarkSnapshotsInserted: persistedBenchmarks.inserted,
    capPerSource: maxRowsPerSource,
    sources: allResults.map((result) => ({
      name: result.name,
      fetchedRows: result.fetchedRows,
      storedRows: result.rows.length,
      benchmarkRows: isArtificialAnalysisResult(result) ? result.benchmarks.length : 0,
      error: result.error
    }))
  };
}
