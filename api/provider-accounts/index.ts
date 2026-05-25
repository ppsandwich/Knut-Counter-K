import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProviderAccount, ensureUserProfile, softDeleteProviderAccount, updateProviderAccount } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (!["POST", "PATCH", "DELETE"].includes(req.method ?? "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureUserProfile({
      id: user.id,
      email: user.email
    });

    if (req.method === "PATCH") {
      const providerAccountId = String(req.body?.providerAccountId ?? "");
      if (!providerAccountId) {
        return res.status(400).json({ error: "providerAccountId is required" });
      }

      const account = await updateProviderAccount(user.id, {
        providerAccountId,
        displayName: req.body?.displayName === undefined ? undefined : String(req.body.displayName),
        planName: req.body?.planName === undefined ? undefined : req.body.planName == null ? null : String(req.body.planName),
        billingCurrency: req.body?.billingCurrency === undefined ? undefined : req.body.billingCurrency == null ? null : String(req.body.billingCurrency),
        monthlyBudget: req.body?.monthlyBudget === undefined ? undefined : req.body.monthlyBudget == null ? null : Number(req.body.monthlyBudget),
        resetRule: req.body?.resetRule === undefined ? undefined : req.body.resetRule == null ? null : String(req.body.resetRule),
        syncStatus: req.body?.syncStatus === "paused" ? "paused" : req.body?.syncStatus === "idle" ? "idle" : undefined
      });

      return res.status(200).json({ ok: true, account });
    }

    if (req.method === "DELETE") {
      const providerAccountId = String(req.query.providerAccountId ?? req.body?.providerAccountId ?? "");
      if (!providerAccountId) {
        return res.status(400).json({ error: "providerAccountId is required" });
      }

      return res.status(200).json({
        ok: true,
        ...(await softDeleteProviderAccount(user.id, providerAccountId))
      });
    }

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
