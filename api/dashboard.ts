import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureUserProfile, getUserProfile, listProviderAccountsForUser } from "@knut/db";
import { requireUser } from "./auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureUserProfile({ id: user.id, email: user.email });

    const [profile, providers] = await Promise.all([
      getUserProfile(user.id),
      listProviderAccountsForUser(user.id)
    ]);

    return res.status(200).json({
      ok: true,
      profile,
      providers
    });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
