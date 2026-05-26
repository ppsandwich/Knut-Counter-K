import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureUserProfile, getDashboardModelPicks, getDashboardSummaryForUser, getUserProfile, listProviderAccountsForUser } from "@knut/db";
import { requireUser } from "../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureUserProfile({ id: user.id, email: user.email });

    const profile = await getUserProfile(user.id);
    const [providers, summary, modelPicks] = await Promise.all([
      listProviderAccountsForUser(user.id),
      getDashboardSummaryForUser(user.id, profile),
      getDashboardModelPicks().catch(() => ({
        smartest: null,
        bestValue: null,
        cheapest: null
      }))
    ]);

    return res.status(200).json({
      ok: true,
      profile,
      summary,
      providers,
      modelPicks
    });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
