import type { VercelRequest, VercelResponse } from "@vercel/node";
import { recommendProviderForUser } from "@knut/db";
import type { RecommendationInput } from "@knut/shared";
import { requireUser } from "../../apiUtils/auth";

function numberFromBody(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);
    const input: RecommendationInput = {
      taskType: String(req.body?.taskType ?? req.body?.task_type ?? "general"),
      estimatedInputTokens: numberFromBody(req.body?.estimatedInputTokens ?? req.body?.estimated_input_tokens),
      estimatedOutputTokens: numberFromBody(req.body?.estimatedOutputTokens ?? req.body?.estimated_output_tokens),
      excludeNearCapProviders: Boolean(req.body?.excludeNearCapProviders ?? req.body?.exclude_near_cap_providers)
    };

    const recommendations = await recommendProviderForUser(user.id, input);
    if (!recommendations) {
      return res.status(404).json({
        error: "No priced connected provider was found. Refresh pricing and connect at least one supported API provider."
      });
    }

    const recommendation = recommendations.balanced;
    return res.status(200).json({
      ok: true,
      recommendations,
      recommendation,
      recommended_provider: recommendation.recommendedProvider,
      recommended_provider_id: recommendation.recommendedProviderId,
      provider_account_id: recommendation.providerAccountId,
      recommended_model: recommendation.recommendedModel,
      estimated_cost_usd: recommendation.estimatedCostUsd,
      intelligence_score: recommendation.intelligenceScore,
      intelligence_source: recommendation.intelligenceSource,
      cap_warning: recommendation.capWarning,
      reason: recommendation.reason,
      price_source: recommendation.priceSource,
      price_confidence: recommendation.priceConfidence,
      fetched_at: recommendation.fetchedAt
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Recommendation failed."
    });
  }
}
