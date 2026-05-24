import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchLiteLlmPricing, fetchModelsDevPricing, fetchOpenRouterPricing, normalisePricing } from "@knut/pricing";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [modelsDev, liteLlm, openRouter] = await Promise.all([
    fetchModelsDevPricing(),
    fetchLiteLlmPricing(),
    fetchOpenRouterPricing()
  ]);

  const snapshots = normalisePricing([...openRouter, ...modelsDev, ...liteLlm]);
  return res.status(200).json({ ok: true, snapshots: snapshots.length });
}
