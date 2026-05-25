import type { ProviderConnector } from "../types";

type GeminiModelsResponse = {
  models?: Array<{
    name?: string;
    displayName?: string;
  }>;
};

async function geminiGet<T>(path: string, apiKey: string) {
  const url = new URL(`https://generativelanguage.googleapis.com${path}`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

export const geminiConnector: ProviderConnector = {
  providerId: "google_gemini_api",
  displayName: "Google Gemini API",
  connectorStatus: "response_metadata_supported",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    const data = await geminiGet<GeminiModelsResponse>("/v1beta/models", input.apiKey);
    return {
      ok: true,
      message: `Gemini key can list ${data.models?.length ?? 0} models. Account-level spend sync is not exposed for this key.`
    };
  },
  async fetchUsage() {
    throw new Error("Gemini API keys do not expose account-level usage or spend through the Gemini API. Track Gemini with response metadata imports, manual usage entry, or Google Cloud Billing/Vertex AI integration later.");
  }
};
