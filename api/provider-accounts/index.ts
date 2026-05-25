import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProviderAccount, ensureUserProfile } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureUserProfile({
      id: user.id,
      email: user.email
    });

    const account = await createProviderAccount(user.id, {
      providerId: String(req.body?.providerId ?? ""),
      displayName: String(req.body?.displayName ?? ""),
      authType: req.body?.authType ?? "manual",
      apiKey: req.body?.apiKey ? String(req.body.apiKey) : undefined,
      planName: req.body?.planName ? String(req.body.planName) : undefined,
      billingCurrency: req.body?.billingCurrency ? String(req.body.billingCurrency) : undefined,
      monthlyBudget: req.body?.monthlyBudget == null ? null : Number(req.body.monthlyBudget),
      resetRule: req.body?.resetRule ? String(req.body.resetRule) : undefined
    });

    return res.status(201).json({ ok: true, account });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
