import type { ProviderConnector } from "../types";

export const openRouterConnector: ProviderConnector = {
  providerId: "openrouter",
  displayName: "OpenRouter",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    return {
      ok: Boolean(input.apiKey),
      message: input.apiKey ? "OpenRouter key supplied." : "API key is required."
    };
  }
};
