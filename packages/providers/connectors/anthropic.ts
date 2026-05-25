import type { ProviderConnector } from "../types";

type AnthropicUsageBucket = {
  starting_at?: string;
  ending_at?: string;
  start_time?: string;
  end_time?: string;
  results?: Array<Record<string, unknown>>;
};

type AnthropicUsageResponse = {
  data?: AnthropicUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

type AnthropicCostBucket = {
  starting_at?: string;
  ending_at?: string;
  start_time?: string;
  end_time?: string;
  results?: Array<Record<string, unknown>>;
};

type AnthropicCostResponse = {
  data?: AnthropicCostBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

const anthropicVersion = "2023-06-01";

function numberFromUnknown(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringFromUnknown(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function bucketStart(bucket: AnthropicUsageBucket | AnthropicCostBucket) {
  return stringFromUnknown(bucket.starting_at ?? bucket.start_time, new Date().toISOString());
}

function lowestUnitsToUsd(value: unknown) {
  return numberFromUnknown(value) / 100;
}

async function anthropicGet<T>(path: string, apiKey: string, params?: Record<string, string | number | string[]>) {
  const url = new URL(`https://api.anthropic.com${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(`${key}[]`, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "anthropic-version": anthropicVersion,
      "x-api-key": apiKey,
      "User-Agent": "KnutCounter/0.1"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

async function validateAnyAnthropicKey(apiKey: string) {
  if (apiKey.startsWith("sk-ant-admin")) {
    await anthropicGet<{ data?: unknown[] }>("/v1/organizations/api_keys", apiKey, { limit: 1 });
    return "Anthropic Admin key can read usage and cost reports.";
  }

  await anthropicGet<{ data?: unknown[] }>("/v1/models", apiKey);
  return "Anthropic API key is valid. Usage sync requires an Admin API key.";
}

async function fetchUsagePages(apiKey: string, since: string, until: string) {
  const buckets: AnthropicUsageBucket[] = [];
  let page: string | undefined;

  do {
    const data = await anthropicGet<AnthropicUsageResponse>("/v1/organizations/usage_report/messages", apiKey, {
      starting_at: since,
      ending_at: until,
      bucket_width: "1d",
      limit: 31,
      group_by: ["model"],
      ...(page ? { page } : {})
    });
    buckets.push(...(data.data ?? []));
    page = data.next_page ?? undefined;
    if (!data.has_more) break;
  } while (page);

  return buckets;
}

async function fetchCostPages(apiKey: string, since: string, until: string) {
  const buckets: AnthropicCostBucket[] = [];
  let page: string | undefined;

  do {
    const data = await anthropicGet<AnthropicCostResponse>("/v1/organizations/cost_report", apiKey, {
      starting_at: since,
      ending_at: until,
      limit: 31,
      group_by: ["description"],
      ...(page ? { page } : {})
    });
    buckets.push(...(data.data ?? []));
    page = data.next_page ?? undefined;
    if (!data.has_more) break;
  } while (page);

  return buckets;
}

export const anthropicConnector: ProviderConnector = {
  providerId: "anthropic_api",
  displayName: "Anthropic Claude API",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    const message = await validateAnyAnthropicKey(input.apiKey);
    return {
      ok: true,
      message
    };
  },
  async fetchUsage(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key is required.");
    }
    if (!apiKey.startsWith("sk-ant-admin")) {
      throw new Error("Anthropic usage sync requires an Admin API key starting with sk-ant-admin. Standard API keys can still be tracked through response metadata, manual entry, or imports.");
    }

    const usageBuckets = await fetchUsagePages(apiKey, input.since, input.until);
    const costBuckets = await fetchCostPages(apiKey, input.since, input.until);
    const usageRecords = usageBuckets.flatMap((bucket) =>
      (bucket.results ?? []).map((result) => {
        const modelId = stringFromUnknown(result.model, "unknown");
        const uncachedInputTokens = numberFromUnknown(result.uncached_input_tokens ?? result.input_tokens);
        const cachedInputTokens = numberFromUnknown(result.cached_input_tokens);
        const cacheCreationInputTokens = numberFromUnknown(result.cache_creation_input_tokens);
        const outputTokens = numberFromUnknown(result.output_tokens);

        return {
          providerId: "anthropic_api",
          modelId,
          sourceType: "anthropic_usage_api",
          sourceRef: `anthropic:usage:messages:${bucketStart(bucket)}:${modelId}`,
          inputTokens: uncachedInputTokens + cacheCreationInputTokens,
          cachedTokens: cachedInputTokens,
          outputTokens,
          requestCount: numberFromUnknown(result.requests ?? result.num_model_requests),
          confidence: "exact" as const,
          observedAt: new Date(bucketStart(bucket)).toISOString()
        };
      })
    );
    const costRecords = costBuckets.flatMap((bucket) =>
      (bucket.results ?? []).map((result) => {
        const description = stringFromUnknown(result.description ?? result.model, "anthropic_cost");
        const amount = typeof result.amount === "object" && result.amount
          ? numberFromUnknown((result.amount as { value?: unknown }).value)
          : lowestUnitsToUsd(result.cost ?? result.amount);

        return {
          providerId: "anthropic_api",
          modelId: description,
          sourceType: "anthropic_cost_api",
          sourceRef: `anthropic:cost:${bucketStart(bucket)}:${description}`,
          costAmount: amount,
          costCurrency: "USD",
          confidence: "exact" as const,
          observedAt: new Date(bucketStart(bucket)).toISOString()
        };
      })
    );

    return [...usageRecords, ...costRecords];
  }
};
