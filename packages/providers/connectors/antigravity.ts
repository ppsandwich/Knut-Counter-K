import type { ProviderConnector } from "../types";

const CLOUDCODE_BASE = "https://cloudcode-pa.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type LoadCodeAssistResponse = {
  codeAssistEnabled?: boolean;
  planInfo?: {
    monthlyPromptCredits?: number;
    planType?: string;
  };
  availablePromptCredits?: number;
  cloudaicompanionProject?: string | { id?: string };
  currentTier?: {
    id?: string;
    name?: string;
  };
};

type ModelInfo = {
  displayName?: string;
  model?: string;
  label?: string;
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
    isExhausted?: boolean;
  };
};

type FetchModelsResponse = {
  models?: Record<string, ModelInfo>;
};

function parseStoredTokens(raw: string): StoredTokens {
  const parsed = JSON.parse(raw);
  if (!parsed.refresh_token) {
    throw new Error("No refresh token found in stored credentials.");
  }
  return parsed as StoredTokens;
}

function encodeTokens(tokens: StoredTokens): string {
  return JSON.stringify(tokens);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const clientSecret = process.env.GOOGLE_CLOUDCODE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLOUDCODE_CLIENT_SECRET environment variable is required.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000
  };
}

async function getValidAccessToken(raw: string): Promise<{ accessToken: string; updatedRaw: string }> {
  const tokens = parseStoredTokens(raw);

  if (tokens.expires_at > Date.now() + 60_000) {
    return { accessToken: tokens.access_token, updatedRaw: raw };
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const updated: StoredTokens = {
    access_token: refreshed.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: refreshed.expires_at
  };

  return { accessToken: updated.access_token, updatedRaw: encodeTokens(updated) };
}

async function cloudcodePost<T>(accessToken: string, endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${CLOUDCODE_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "antigravity"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloud Code API ${endpoint} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export const antigravityConnector: ProviderConnector = {
  providerId: "antigravity",
  displayName: "Antigravity",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return { ok: false, message: "OAuth tokens are required." };
    }

    try {
      const { accessToken } = await getValidAccessToken(input.apiKey);
      await cloudcodePost<LoadCodeAssistResponse>(accessToken, "/v1internal:loadCodeAssist", {
        metadata: { ideType: "ANTIGRAVITY", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" }
      });
      return { ok: true, message: "Antigravity session is valid." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to validate Antigravity credentials."
      };
    }
  },
  async fetchCaps(input) {
    const raw = input.credentials?.apiKey;
    if (!raw) {
      throw new Error("Antigravity OAuth tokens are required.");
    }

    const { accessToken, updatedRaw } = await getValidAccessToken(raw);

    const loadResponse = await cloudcodePost<LoadCodeAssistResponse>(accessToken, "/v1internal:loadCodeAssist", {
      metadata: { ideType: "ANTIGRAVITY", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" }
    });

    const projectId = typeof loadResponse.cloudaicompanionProject === "string"
      ? loadResponse.cloudaicompanionProject
      : loadResponse.cloudaicompanionProject?.id;

    const modelsResponse = await cloudcodePost<FetchModelsResponse>(
      accessToken,
      "/v1internal:fetchAvailableModels",
      projectId ? { project: projectId } : {}
    );

    const caps = [];

    if (loadResponse.planInfo?.monthlyPromptCredits) {
      const monthly = loadResponse.planInfo.monthlyPromptCredits;
      const available = loadResponse.availablePromptCredits ?? monthly;
      const used = monthly - available;
      caps.push({
        capType: "token_quota",
        capLabel: `${loadResponse.planInfo.planType ?? "Antigravity"} prompt credits`,
        capAmount: monthly,
        capUnit: "credits",
        usedAmount: Math.max(0, used),
        confidence: "provider_reported" as const
      });
    }

    if (modelsResponse.models) {
      for (const [modelId, info] of Object.entries(modelsResponse.models)) {
        if (info.quotaInfo?.remainingFraction != null) {
          const remaining = info.quotaInfo.remainingFraction;
          const usedFraction = Math.max(0, 1 - remaining);
          caps.push({
            capType: "token_quota",
            capLabel: info.displayName ?? info.label ?? modelId,
            capAmount: 100,
            capUnit: "percent",
            usedAmount: Math.round(usedFraction * 10000) / 100,
            confidence: "provider_reported" as const
          });
        }
      }
    }

    return caps;
  },
  async fetchUsage(input) {
    const raw = input.credentials?.apiKey;
    if (!raw) return [];

    const { accessToken } = await getValidAccessToken(raw);

    const loadResponse = await cloudcodePost<LoadCodeAssistResponse>(accessToken, "/v1internal:loadCodeAssist", {
      metadata: { ideType: "ANTIGRAVITY", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" }
    });

    const projectId = typeof loadResponse.cloudaicompanionProject === "string"
      ? loadResponse.cloudaicompanionProject
      : loadResponse.cloudaicompanionProject?.id;

    const modelsResponse = await cloudcodePost<FetchModelsResponse>(
      accessToken,
      "/v1internal:fetchAvailableModels",
      projectId ? { project: projectId } : {}
    );

    const records = [];
    if (modelsResponse.models) {
      for (const [modelId, info] of Object.entries(modelsResponse.models)) {
        if (info.quotaInfo?.remainingFraction != null) {
          records.push({
            providerId: "antigravity",
            modelId,
            sourceType: "cloudcode_quota_api",
            sourceRef: `antigravity:quota:${modelId}:${new Date().toISOString().slice(0, 10)}`,
            confidence: "provider_reported" as const,
            observedAt: new Date().toISOString()
          });
        }
      }
    }

    return records;
  }
};
