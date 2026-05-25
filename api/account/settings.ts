import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateUserSettings, upsertUserProfile } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "PATCH") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const input = {
      timezone: String(req.body?.timezone ?? "UTC"),
      preferredCurrency: String(req.body?.preferredCurrency ?? "USD"),
      monthlyAiBudget: req.body?.monthlyAiBudget == null ? null : Number(req.body.monthlyAiBudget)
    };

    await upsertUserProfile({
      id: user.id,
      email: user.email,
      ...input
    });

    const settings = await updateUserSettings(user.id, input);

    return res.status(200).json({ ok: true, settings });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
