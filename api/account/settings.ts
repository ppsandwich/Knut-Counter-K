import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateUserSettings, upsertUserProfile } from "@knut/db";
import { normaliseCurrencyCode } from "@knut/shared";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "PATCH" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);
    const input = {
      timezone: String(req.body?.timezone ?? "UTC"),
      preferredCurrency: normaliseCurrencyCode(String(req.body?.preferredCurrency ?? "USD")),
      monthlyAiBudget: req.body?.monthlyAiBudget == null || req.body.monthlyAiBudget === "" ? null : Number(req.body.monthlyAiBudget)
    };

    await upsertUserProfile({
      id: user.id,
      email: user.email,
      ...input
    });

    const settings = await updateUserSettings(user.id, input);
    return res.status(200).json({ ok: true, settings });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Settings update failed."
    });
  }
}
