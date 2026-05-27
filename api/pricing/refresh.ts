import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const refreshSecret = process.env.PRICING_REFRESH_SECRET;
    if (refreshSecret && req.headers["x-knut-job-secret"] !== refreshSecret) {
      return res.status(401).json({ error: "Unauthorized pricing refresh." });
    }

    const { refreshModelData } = await import("../../apiUtils/pricingRefresh");
    const result = await refreshModelData();

    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("Pricing refresh failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Pricing refresh failed"
    });
  }
}
