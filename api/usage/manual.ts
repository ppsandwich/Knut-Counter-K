import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createManualUsageRecord } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providerAccountId = String(req.body?.providerAccountId ?? "");
    if (!providerAccountId) {
      return res.status(400).json({ error: "providerAccountId is required" });
    }

    const observedAt = String(req.body?.observedAt ?? new Date().toISOString());
    const record = await createManualUsageRecord(user.id, {
      providerAccountId,
      modelId: req.body?.modelId ? String(req.body.modelId) : undefined,
      inputTokens: optionalNumber(req.body?.inputTokens),
      outputTokens: optionalNumber(req.body?.outputTokens),
      totalTokens: optionalNumber(req.body?.totalTokens),
      requestCount: optionalNumber(req.body?.requestCount),
      messageCount: optionalNumber(req.body?.messageCount),
      costAmount: optionalNumber(req.body?.costAmount),
      costCurrency: req.body?.costCurrency ? String(req.body.costCurrency) : "USD",
      observedAt,
      sourceRef: req.body?.sourceRef ? String(req.body.sourceRef) : undefined
    });

    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
