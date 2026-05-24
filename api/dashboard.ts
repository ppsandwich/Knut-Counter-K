import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureUserProfile, getDashboardSummaryForUser, getUserProfile, listProviderAccountsForUser } from "@knut/db";
import { requireUser } from "./auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureUserProfile({ id: user.id, email: user.email });

    const profile = await getUserProfile(user.id);
    const [providers, summary] = await Promise.all([
      listProviderAccountsForUser(user.id),
      getDashboardSummaryForUser(user.id, profile)
    ]);

    return res.status(200).json({
      ok: true,
      profile,
      summary,
      providers
    });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
