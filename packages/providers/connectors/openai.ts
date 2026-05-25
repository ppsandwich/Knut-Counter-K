import type { ProviderConnector } from "../types";

type OpenAiUsageBucket = {
  start_time: number;
  end_time: number;
  results?: Array<{
    input_tokens?: number;
    output_tokens?: number;
    input_cached_tokens?: number;
    num_model_requests?: number;
    model?: string | null;
  }>;
};

type OpenAiUsageResponse = {
  data?: OpenAiUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

type OpenAiCostsBucket = {
  start_time: number;
  end_time: number;
  results?: Array<{
    amount?: {
      value?: number;
      currency?: string;
    };
    line_item?: string | null;
    project_id?: string | null;
  }>;
};

type OpenAiCostsResponse = {
  data?: OpenAiCostsBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

async function openAiGet<T>(path: string, apiKey: string, params?: Record<string, string | number | string[]>) {
  const url = new URL(`https://api.openai.com${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAllUsagePages(apiKey: string, since: string, until: string) {
  const startTime = Math.floor(new Date(since).getTime() / 1000);
  const endTime = Math.floor(new Date(until).getTime() / 1000);
  const buckets: OpenAiUsageBucket[] = [];
  let page: string | undefined;

  do {
    const data = await openAiGet<OpenAiUsageResponse>("/v1/organization/usage/completions", apiKey, {
      start_time: startTime,
      end_time: endTime,
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

async function fetchAllCostPages(apiKey: string, since: string, until: string) {
  const startTime = Math.floor(new Date(since).getTime() / 1000);
  const endTime = Math.floor(new Date(until).getTime() / 1000);
  const buckets: OpenAiCostsBucket[] = [];
  let page: string | undefined;

  do {
    const data = await openAiGet<OpenAiCostsResponse>("/v1/organization/costs", apiKey, {
      start_time: startTime,
      end_time: endTime,
      bucket_width: "1d",
      limit: 31,
      group_by: ["line_item"],
      ...(page ? { page } : {})
    });
    buckets.push(...(data.data ?? []));
    page = data.next_page ?? undefined;
    if (!data.has_more) break;
  } while (page);

  return buckets;
}

export const openAiConnector: ProviderConnector = {
  providerId: "openai_api",
  displayName: "OpenAI API",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    await openAiGet<{ data?: unknown[] }>("/v1/models", input.apiKey);
    return {
      ok: true,
      message: "OpenAI key can call the API. Usage sync may require an organization admin key."
    };
  },
  async fetchUsage(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }

    const usageBuckets = await fetchAllUsagePages(apiKey, input.since, input.until);
    const costBuckets = await fetchAllCostPages(apiKey, input.since, input.until);
    const usageRecords = usageBuckets.flatMap((bucket) =>
      (bucket.results ?? []).map((result) => {
        const modelId = result.model ?? "unknown";
        return {
          providerId: "openai_api",
          modelId,
          sourceType: "openai_usage_api",
          sourceRef: `openai:usage:completions:${bucket.start_time}:${bucket.end_time}:${modelId}`,
          inputTokens: result.input_tokens ?? 0,
          outputTokens: result.output_tokens ?? 0,
          cachedTokens: result.input_cached_tokens ?? 0,
          requestCount: result.num_model_requests ?? 0,
          confidence: "exact" as const,
          observedAt: new Date(bucket.start_time * 1000).toISOString()
        };
      })
    );
    const costRecords = costBuckets.flatMap((bucket) =>
      (bucket.results ?? []).map((result) => {
        const lineItem = result.line_item ?? "openai_costs";
        const projectId = result.project_id ?? "all_projects";
        return {
          providerId: "openai_api",
          modelId: lineItem,
          sourceType: "openai_costs_api",
          sourceRef: `openai:costs:${bucket.start_time}:${bucket.end_time}:${lineItem}:${projectId}`,
          costAmount: result.amount?.value ?? 0,
          costCurrency: (result.amount?.currency ?? "usd").toUpperCase(),
          confidence: "exact" as const,
          observedAt: new Date(bucket.start_time * 1000).toISOString()
        };
      })
    );

    return [...usageRecords, ...costRecords];
  }
};
