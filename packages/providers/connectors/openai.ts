import type { ProviderConnector } from "../types";

export const openAiConnector: ProviderConnector = {
  providerId: "openai_api",
  displayName: "OpenAI API",
  connectorStatus: "response_metadata_supported",
  async validateCredentials(input) {
    return {
      ok: Boolean(input.apiKey?.startsWith("sk-")),
      message: input.apiKey ? "Looks like an OpenAI-style key." : "API key is required."
    };
  }
};
