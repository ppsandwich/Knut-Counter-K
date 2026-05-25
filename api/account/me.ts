import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureUserProfile, getUserProfile, upsertUserProfile } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.method === "GET") {
      await ensureUserProfile({ id: user.id, email: user.email });
      const profile = await getUserProfile(user.id);
      return res.status(200).json({ ok: true, profile });
    }

    const profile = await upsertUserProfile({
      id: user.id,
      email: user.email,
      timezone: String(req.body?.timezone ?? "UTC"),
      preferredCurrency: String(req.body?.preferredCurrency ?? "USD"),
      monthlyAiBudget: req.body?.monthlyAiBudget == null ? null : Number(req.body.monthlyAiBudget)
    });

    return res.status(200).json({ ok: true, profile });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
