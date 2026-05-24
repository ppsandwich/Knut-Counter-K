import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const inputTokens = Number(req.body?.estimated_input_tokens ?? 0);
  const outputTokens = Number(req.body?.estimated_output_tokens ?? 0);
  const estimatedCostUsd = ((inputTokens * 0.1) + (outputTokens * 0.4)) / 1_000_000;

  return res.status(200).json({
    recommended_provider: "Google Gemini API",
    recommended_model: "Gemini Flash",
    estimated_cost_usd: estimatedCostUsd,
    cap_warning: null,
    reason: "Cheap, fast, and unlikely to cause budget theatrics."
  });
}
