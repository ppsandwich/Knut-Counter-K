import type { ProviderConnector } from "../types";

export const manualConnector: ProviderConnector = {
  providerId: "manual",
  displayName: "Manual tracking",
  connectorStatus: "manual_import_supported"
};
