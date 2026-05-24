import type { ProviderConnector } from "../types";

export const anthropicConnector: ProviderConnector = {
  providerId: "anthropic_api",
  displayName: "Anthropic Claude API",
  connectorStatus: "response_metadata_supported",
  async validateCredentials(input) {
    return {
      ok: Boolean(input.apiKey),
      message: input.apiKey ? "Credential shape accepted for validation." : "API key is required."
    };
  }
};
