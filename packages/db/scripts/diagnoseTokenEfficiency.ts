import { ilike, or, sql } from "drizzle-orm";
import { closeDb, getDb } from "../client";
import { modelBenchmarkSnapshots } from "../schema";

const searchTerms = process.argv.slice(2);

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstPositiveNumber(source: unknown): number | null {
  if (!source || typeof source !== "object") return positiveNumber(source);

  if (Array.isArray(source)) {
    for (const item of source) {
      const parsed = firstPositiveNumber(item);
      if (parsed != null) return parsed;
    }

    return null;
  }

  const record = source as Record<string, unknown>;
  for (const key of ["total", "total_tokens", "tokens", "token_use", "token_usage", "output", "output_tokens", "reasoning", "reasoning_tokens", "answer", "answer_tokens"]) {
    const parsed = positiveNumber(record[key]);
    if (parsed != null) return parsed;
  }

  for (const value of Object.values(record)) {
    const parsed = firstPositiveNumber(value);
    if (parsed != null) return parsed;
  }

  return null;
}

function isTokenUseKey(key: string) {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!normalised.includes("token")) return false;
  if (/(price|cost|usd|dollar|rate|per|second|latency|speed|throughput|context|window|limit)/.test(normalised)) return false;

  return (
    /(output|reasoning|answer|completion).*(used|use|count|total)/.test(normalised)
    || /(used|use|count|total).*(output|reasoning|answer|completion)/.test(normalised)
    || /intelligence.*index.*token/.test(normalised)
    || /token.*(use|usage|used|count|total)/.test(normalised)
    || /(use|usage|used|count|total).*token/.test(normalised)
  );
}

function walkTokenPaths(source: unknown, path: string[] = [], matches: Array<{ path: string; value: unknown; extracted: number | null }> = []) {
  if (!source || typeof source !== "object") return matches;

  if (Array.isArray(source)) {
    source.forEach((item, index) => walkTokenPaths(item, [...path, String(index)], matches));
    return matches;
  }

  for (const [key, value] of Object.entries(source)) {
    const nextPath = [...path, key];
    if (key.toLowerCase().includes("token")) {
      matches.push({
        path: nextPath.join("."),
        value,
        extracted: isTokenUseKey(key) ? positiveNumber(value) ?? firstPositiveNumber(value) : null
      });
    }

    walkTokenPaths(value, nextPath, matches);
  }

  return matches;
}

async function main() {
  if (!searchTerms.length) {
    throw new Error("Pass one or more model search terms, for example: gpt-5.5 ling-2.6");
  }

  const rows = await getDb()
    .select({
      providerId: modelBenchmarkSnapshots.providerId,
      modelId: modelBenchmarkSnapshots.modelId,
      modelDisplayName: modelBenchmarkSnapshots.modelDisplayName,
      evaluations: modelBenchmarkSnapshots.evaluations,
      pricing: modelBenchmarkSnapshots.pricing,
      fetchedAt: modelBenchmarkSnapshots.fetchedAt
    })
    .from(modelBenchmarkSnapshots)
    .where(or(...searchTerms.flatMap((term) => [
      ilike(modelBenchmarkSnapshots.modelId, `%${term}%`),
      ilike(modelBenchmarkSnapshots.modelDisplayName, `%${term}%`)
    ])))
    .orderBy(sql`${modelBenchmarkSnapshots.fetchedAt} desc`)
    .limit(20);

  if (!rows.length) {
    console.log(`No benchmark rows matched: ${searchTerms.join(", ")}`);
    return;
  }

  for (const row of rows) {
    const evaluationMatches = walkTokenPaths(row.evaluations);
    const pricingMatches = walkTokenPaths(row.pricing);
    const extracted = [...evaluationMatches, ...pricingMatches].find((match) => match.extracted != null)?.extracted ?? null;

    console.log("\n---");
    console.log(`${row.providerId} | ${row.modelDisplayName} | ${row.modelId}`);
    console.log(`fetchedAt: ${row.fetchedAt.toISOString()}`);
    console.log(`extractedTokenUse: ${extracted ?? "none"}`);

    const matches = [...evaluationMatches.map((match) => ({ ...match, source: "evaluations" })), ...pricingMatches.map((match) => ({ ...match, source: "pricing" }))];
    if (!matches.length) {
      console.log("No token-related JSON keys found.");
      continue;
    }

    for (const match of matches.slice(0, 30)) {
      const value = typeof match.value === "object" ? JSON.stringify(match.value).slice(0, 180) : String(match.value);
      console.log(`${match.source}.${match.path} = ${value}${match.extracted == null ? "" : ` -> ${match.extracted}`}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
