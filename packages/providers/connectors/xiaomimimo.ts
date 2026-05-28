import type { ProviderConnector } from "../types";

const USAGE_URL = "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage";

type MimoUsageItem = {
  name: string;
  used: number;
  limit: number;
  percent: number;
};

type MimoUsageResponse = {
  code: number;
  message: string;
  data: {
    monthUsage: {
      percent: number;
      items: MimoUsageItem[];
    };
    usage: {
      percent: number;
      items: MimoUsageItem[];
    };
  };
};

async function fetchUsage(cookie: string) {
  const response = await fetch(USAGE_URL, {
    headers: {
      cookie,
      accept: "*/*",
      "content-type": "application/json",
      referer: "https://platform.xiaomimimo.com/console/plan-manage"
    }
  });

  if (!response.ok) {
    throw new Error(`MiMo usage fetch failed: ${response.status}`);
  }

  const json = (await response.json()) as MimoUsageResponse;
  if (json.code !== 0) {
    throw new Error(`MiMo API error: ${json.message ?? json.code}`);
  }

  return json.data;
}

export const xiaomimimoConnector: ProviderConnector = {
  providerId: "xiaomimimo",
  displayName: "Xiaomi MiMo",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return { ok: false, message: "Session cookie is required." };
    }

    try {
      await fetchUsage(input.apiKey);
      return { ok: true, message: "MiMo session is valid." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to reach MiMo API."
      };
    }
  },
  async fetchCaps(input) {
    const cookie = input.credentials?.apiKey;
    if (!cookie) {
      throw new Error("MiMo session cookie is required.");
    }

    const data = await fetchUsage(cookie);
    const planItem = data.usage.items.find((i) => i.name === "plan_total_token");
    const monthItem = data.monthUsage.items.find((i) => i.name === "month_total_token");

    return [
      {
        capType: "token_quota",
        capLabel: "Monthly token usage",
        capAmount: monthItem?.limit ?? 0,
        capUnit: "tokens",
        usedAmount: monthItem?.used ?? 0,
        confidence: "provider_reported" as const
      },
      {
        capType: "token_quota",
        capLabel: "Plan total tokens",
        capAmount: planItem?.limit ?? 0,
        capUnit: "tokens",
        usedAmount: planItem?.used ?? 0,
        confidence: "provider_reported" as const
      }
    ];
  }
};
