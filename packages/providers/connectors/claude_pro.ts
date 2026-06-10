import type { ProviderConnector, UsageRecord } from "../types";

export const claudeProConnector: ProviderConnector = {
  providerId: "claude_pro",
  displayName: "Claude Pro / Team",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey || !input.organizationId) {
      return {
        ok: false,
        message: "sessionKey (API Key field) and Organization ID are required."
      };
    }

    let sessionKey = input.apiKey;
    // If the user pasted their entire Cookie string, extract just the sessionKey part
    if (sessionKey && sessionKey.includes("sessionKey=")) {
      const match = sessionKey.match(/sessionKey=([^;]+)/);
      if (match && match[1]) {
        sessionKey = match[1];
      }
    }

    try {
      const url = `https://claude.ai/api/organizations/${input.organizationId}/usage`;
      const response = await fetch(url, {
        headers: {
          "Cookie": `sessionKey=${sessionKey}`,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 403) {
           return { ok: false, message: "Blocked by Cloudflare or invalid sessionKey (403 Forbidden)." };
        }
        return { ok: false, message: `Failed to validate: ${response.status} ${body}` };
      }

      return {
        ok: true,
        message: "Claude Pro session valid."
      };
    } catch (error: any) {
      return {
        ok: false,
        message: `Error connecting to Claude API: ${error.message}`
      };
    }
  },
  async fetchUsage(input) {
    let sessionKey = input.credentials?.apiKey;
    const orgId = input.credentials?.organizationId;
    
    if (!sessionKey || !orgId) {
      throw new Error("Claude sessionKey and Organization ID are required.");
    }

    // If the user pasted their entire Cookie string, extract just the sessionKey part
    if (sessionKey.includes("sessionKey=")) {
      const match = sessionKey.match(/sessionKey=([^;]+)/);
      if (match && match[1]) {
        sessionKey = match[1];
      }
    }

    const url = `https://claude.ai/api/organizations/${orgId}/usage`;
    const response = await fetch(url, {
      headers: {
        "Cookie": `sessionKey=${sessionKey}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Blocked by Cloudflare (403). The server IP may be flagged, or the sessionKey is expired.");
      }
      throw new Error(`Failed to fetch Claude usage: ${response.status}`);
    }

    const data = await response.json();
    const records: UsageRecord[] = [];
    
    // We expect the payload might have an array of usage elements.
    // Since this is an undocumented internal API, we map it best-effort or simply record the fetch success.
    // If there is an array of data, try to parse it.
    if (data && typeof data === "object") {
        // Look for any array inside the response
        const arrayData = Array.isArray(data) ? data : (Object.values(data).find(Array.isArray) as any[]);
        
        if (arrayData) {
            for (const item of arrayData) {
                records.push({
                    providerId: "claude_pro",
                    modelId: item.model || "claude_pro_model",
                    sourceType: "web_session_api",
                    sourceRef: `claude_pro:${orgId}:${item.id || new Date().toISOString()}`,
                    inputTokens: item.input_tokens ? Number(item.input_tokens) : 0,
                    outputTokens: item.output_tokens ? Number(item.output_tokens) : 0,
                    confidence: "estimated",
                    observedAt: item.date || item.created_at || new Date().toISOString()
                });
            }
        }
    }

    // Always inject the flat rate subscription cost if there are no records, just to ensure it tracks the account
    if (records.length === 0) {
       records.push({
          providerId: "claude_pro",
          modelId: "subscription",
          sourceType: "web_session_api",
          sourceRef: `claude_pro:subscription:${new Date().toISOString().substring(0, 10)}`,
          costAmount: 20, // $20 Pro plan
          costCurrency: "USD",
          confidence: "estimated",
          observedAt: new Date().toISOString()
       });
    }

    return records;
  },
  async fetchCaps(input) {
    let sessionKey = input.credentials?.apiKey;
    const orgId = input.credentials?.organizationId;
    
    if (!sessionKey || !orgId) {
      throw new Error("Claude sessionKey and Organization ID are required.");
    }

    if (sessionKey.includes("sessionKey=")) {
      const match = sessionKey.match(/sessionKey=([^;]+)/);
      if (match && match[1]) {
        sessionKey = match[1];
      }
    }

    const url = `https://claude.ai/api/organizations/${orgId}/usage`;
    const response = await fetch(url, {
      headers: {
        "Cookie": `sessionKey=${sessionKey}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Claude utilization caps: ${response.status}`);
    }

    const data = await response.json();
    if (data?.seven_day) {
      return [
        {
          capType: "message_quota",
          capLabel: "7-day Utilization",
          capAmount: 100,
          capUnit: "percent",
          usedAmount: data.seven_day.utilization ?? 0,
          confidence: "provider_reported",
          resetAt: data.seven_day.resets_at
        }
      ];
    }
    
    return [];
  }
};
