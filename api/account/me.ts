import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureUserProfile, exportAccountData, getUserProfile, updateUserSettings, upsertUserProfile } from "@knut/db";
import { normaliseCurrencyCode } from "@knut/shared";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.method === "GET") {
      await ensureUserProfile({ id: user.id, email: user.email });
      if (req.query.action === "export") {
        return res.status(200).json({
          ok: true,
          export: await exportAccountData(user.id)
        });
      }

      const profile = await getUserProfile(user.id);
      return res.status(200).json({ ok: true, profile });
    }

    if (req.method === "PATCH" || req.query.action === "settings") {
      const input = {
        timezone: String(req.body?.timezone ?? "UTC"),
        preferredCurrency: normaliseCurrencyCode(String(req.body?.preferredCurrency ?? "USD")),
        monthlyAiBudget: req.body?.monthlyAiBudget == null ? null : Number(req.body.monthlyAiBudget)
      };

      await upsertUserProfile({
        id: user.id,
        email: user.email,
        ...input
      });

      const settings = await updateUserSettings(user.id, input);
      return res.status(200).json({ ok: true, settings });
    }

    const profile = await upsertUserProfile({
      id: user.id,
      email: user.email,
      timezone: String(req.body?.timezone ?? "UTC"),
      preferredCurrency: normaliseCurrencyCode(String(req.body?.preferredCurrency ?? "USD")),
      monthlyAiBudget: req.body?.monthlyAiBudget == null ? null : Number(req.body.monthlyAiBudget)
    });

    return res.status(200).json({ ok: true, profile });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
