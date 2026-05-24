import type { DataConfidence } from "./types";

export const confidenceLabels: Record<DataConfidence, string> = {
  exact: "Exact",
  api_captured: "API captured",
  provider_reported: "Provider reported",
  estimated: "Estimated",
  manual: "Manual",
  stale: "Stale",
  unknown: "Unknown"
};
