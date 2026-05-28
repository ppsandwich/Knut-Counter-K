import type { AppAlert, DashboardSummary, ProviderUsageSummary, Recommendation } from "./types";

const providers: ProviderUsageSummary[] = [
  {
    providerId: "openai_api",
    providerName: "OpenAI",
    accountDisplayName: "API + ChatGPT",
    primaryMetric: "$12.40",
    secondaryMetric: "3.1M tokens",
    statusBadge: "+18%",
    status: "warning",
    confidence: "api_captured",
    resetCountdown: "9d left",
    lastSyncedAt: "2026-05-24T08:05:00+10:00",
    sparklineData: [7, 9, 8, 10, 12, 11, 15, 17, 16, 21, 20, 24]
  },
  {
    providerId: "anthropic_api",
    providerName: "Claude",
    accountDisplayName: "Max plan",
    primaryMetric: "82%",
    secondaryMetric: "2d left",
    statusBadge: "Crispy",
    status: "danger",
    confidence: "estimated",
    resetCountdown: "2d left",
    lastSyncedAt: "2026-05-24T07:20:00+10:00",
    sparklineData: [4, 5, 7, 6, 8, 11, 13, 15, 16, 19, 22, 25],
    usedPercent: 82,
    resetProgress: 93
  },
  {
    providerId: "google_gemini_api",
    providerName: "Gemini",
    accountDisplayName: "API billing",
    primaryMetric: "$1.83",
    secondaryMetric: "6.6M tokens",
    statusBadge: "Cheap",
    status: "healthy",
    confidence: "api_captured",
    resetCountdown: "15d left",
    lastSyncedAt: "2026-05-24T08:00:00+10:00",
    sparklineData: [12, 9, 8, 8, 7, 8, 6, 7, 7, 6, 5, 6]
  },
  {
    providerId: "openrouter",
    providerName: "OpenRouter",
    accountDisplayName: "Router credits",
    primaryMetric: "$4.17",
    secondaryMetric: "$20 balance",
    statusBadge: "OK",
    status: "healthy",
    confidence: "exact",
    resetCountdown: "no reset",
    lastSyncedAt: "2026-05-24T08:04:00+10:00",
    sparklineData: [2, 2, 3, 2, 4, 3, 5, 4, 6, 6, 5, 7]
  },
  {
    providerId: "xiaomimimo",
    providerName: "MiMo",
    accountDisplayName: "Singapore token plan",
    primaryMetric: "43%",
    secondaryMetric: "Manual",
    statusBadge: "Stale",
    status: "stale",
    confidence: "manual",
    resetCountdown: "18d left",
    lastSyncedAt: "2026-05-21T08:00:00+10:00",
    sparklineData: [4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7],
    usedPercent: 43,
    resetProgress: 40
  }
];

const summary: DashboardSummary = {
  monthlySpend: 43.82,
  monthlyBudget: 120,
  totalTokens: 12_800_000,
  projectedSpend: 89.4,
  status: "warning",
  statusText: "Claude is getting crispy."
};

const recommendation: Recommendation = {
  providerName: "Gemini",
  modelName: "Gemini 2.0 Flash",
  estimatedCostUsd: 0.004,
  confidence: "api_captured",
  reason: "Use Gemini Flash for the next job. Claude is feeling expensive and theatrical."
};

const alerts: AppAlert[] = [
  {
    id: "claude-cap",
    severity: "warning",
    title: "Claude is getting crispy.",
    body: "You have used 82% of this cycle. Maybe save the dramatic rewrites for later."
  },
  {
    id: "mimo-stale",
    severity: "danger",
    title: "This one has gone a bit stale.",
    body: "We have not heard from MiMo in a while. The numbers may be wearing yesterday's hat."
  }
];

export const mockDashboard = {
  summary,
  recommendation,
  providers,
  alerts,
  syncStatus: "4 synced today. 1 manual account needs a nudge."
};
