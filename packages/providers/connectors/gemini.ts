import type { ProviderConnector } from "../types";

export const geminiConnector: ProviderConnector = {
  providerId: "google_gemini_api",
  displayName: "Google Gemini API",
  connectorStatus: "response_metadata_supported",
  async validateCredentials(input) {
    return {
      ok: Boolean(input.apiKey),
      message: input.apiKey ? "Credential shape accepted for validation." : "API key is required."
    };
  }
};
