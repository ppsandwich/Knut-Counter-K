import type { ProviderConnector } from "../types";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

type RateLimitWindow = {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
  reset_at: number;
};

type ChatGptUsageResponse = {
  user_id: string;
  account_id: string;
  email: string;
  plan_type: string;
  rate_limit: {
    allowed: boolean;
    limit_reached: boolean;
    primary_window: RateLimitWindow;
    secondary_window: RateLimitWindow;
  };
  credits: {
    has_credits: boolean;
    unlimited: boolean;
    overage_limit_reached: boolean;
    balance: string;
    approx_local_messages: [number, number];
    approx_cloud_messages: [number, number];
  };
};

async function fetchChatGptUsage(sessionToken: string) {
  const response = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      accept: "*/*",
      "content-type": "application/json",
      referer: "https://chatgpt.com/codex/cloud/settings/analytics"
    }
  });

  if (!response.ok) {
    throw new Error(`ChatGPT usage fetch failed: ${response.status}`);
  }

  return (await response.json()) as ChatGptUsageResponse;
}

export const chatgptPlusConnector: ProviderConnector = {
  providerId: "chatgpt_plus",
  displayName: "ChatGPT Plus",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return { ok: false, message: "Session token is required." };
    }

    try {
      const data = await fetchChatGptUsage(input.apiKey);
      if (!data.plan_type) {
        return { ok: false, message: "Unexpected response from ChatGPT API." };
      }
      return { ok: true, message: `ChatGPT ${data.plan_type} session is valid.` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to reach ChatGPT API."
      };
    }
  },
  async fetchCaps(input) {
    const sessionToken = input.credentials?.apiKey;
    if (!sessionToken) {
      throw new Error("ChatGPT session token is required.");
    }

    const data = await fetchChatGptUsage(sessionToken);
    const { primary_window, secondary_window } = data.rate_limit;

    const secondaryResetAt = secondary_window.reset_at
      ? new Date(secondary_window.reset_at * 1000).toISOString()
      : undefined;

    return [
      {
        capType: "token_quota",
        capLabel: "7-day rate limit",
        capAmount: 100,
        capUnit: "percent",
        usedAmount: secondary_window.used_percent,
        confidence: "provider_reported" as const,
        resetAt: secondaryResetAt
      }
    ];
  }
};
