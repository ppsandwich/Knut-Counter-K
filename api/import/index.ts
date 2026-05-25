import type { VercelRequest, VercelResponse } from "@vercel/node";
import { importOpenRouterGenerationsForUser, importUsageRecordsForUser } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providerAccountId = String(req.body?.providerAccountId ?? "");
    const importType = String(req.body?.importType ?? "usage_rows");
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!providerAccountId) {
      return res.status(400).json({ error: "providerAccountId is required" });
    }

    if (importType === "openrouter_generation_ids") {
      const generationIds = Array.isArray(req.body?.generationIds) ? req.body.generationIds.map(String) : [];
      const result = await importOpenRouterGenerationsForUser(user.id, providerAccountId, generationIds);
      return res.status(200).json({ ok: true, ...result });
    }

    const result = await importUsageRecordsForUser(user.id, {
      providerAccountId,
      rows
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
