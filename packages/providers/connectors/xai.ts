import type { ProviderConnector, UsageRecord } from "../types";

type XaiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_in_usd_ticks?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type XaiResponsePayload = {
  id?: string;
  model?: string;
  created?: number;
  created_at?: number | string;
  usage?: XaiUsage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timestampToIso(value: unknown) {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    const unixSeconds = Number(value);
    if (Number.isFinite(unixSeconds)) return new Date(unixSeconds * 1000).toISOString();
  }

  return new Date().toISOString();
}

function normaliseResponsePayload(payload: unknown, index: number): UsageRecord | null {
  if (!isRecord(payload) || !isRecord(payload.usage)) return null;

  const usage = payload.usage as XaiUsage;
  const id = typeof payload.id === "string" && payload.id.trim() ? payload.id : `payload-${index}`;
  const inputTokens = toNumber(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = toNumber(usage.output_tokens ?? usage.completion_tokens);
  const cachedTokens = toNumber(usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens);
  const reasoningTokens = toNumber(usage.output_tokens_details?.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens);
  const costTicks = toNumber(usage.cost_in_usd_ticks);
  const createdAt = payload.created_at ?? payload.created;

  return {
    providerId: "xai",
    modelId: typeof payload.model === "string" && payload.model.trim() ? payload.model : "unknown",
    sourceType: "xai_response_metadata",
    sourceRef: `xai:response:${id}`,
    inputTokens,
    outputTokens,
    cachedTokens,
    reasoningTokens,
    costAmount: costTicks == null ? undefined : costTicks / 10_000_000_000,
    costCurrency: costTicks == null ? undefined : "USD",
    requestCount: 1,
    confidence: "exact",
    observedAt: timestampToIso(createdAt)
  };
}

async function xaiGet<T>(path: string, apiKey: string) {
  const response = await fetch(`https://api.x.ai${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`xAI API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

export const xaiConnector: ProviderConnector = {
  providerId: "xai",
  displayName: "xAI Grok API",
  connectorStatus: "response_metadata_supported",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    await xaiGet<{ data?: unknown[] }>("/v1/models", input.apiKey);
    return {
      ok: true,
      message: "xAI key can call the API. Usage sync uses response metadata imports for now."
    };
  },
  async fetchUsage(input) {
    const payloads = input.responsePayloads ?? [];
    return payloads
      .map((payload, index) => normaliseResponsePayload(payload, index))
      .filter((record): record is UsageRecord => Boolean(record));
  }
};
