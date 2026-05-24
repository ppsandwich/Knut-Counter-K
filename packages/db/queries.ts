import type { UsageRecord } from "@knut/providers";

export async function createUsageRecords(records: UsageRecord[]) {
  return {
    rowsProcessed: records.length,
    rowsFailed: 0
  };
}

export async function evaluateAlerts() {
  return {
    evaluated: true,
    created: 0
  };
}
