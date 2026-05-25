import type { VercelRequest, VercelResponse } from "@vercel/node";
import { importUsageRecordsForUser } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providerAccountId = String(req.body?.providerAccountId ?? "");
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!providerAccountId) {
      return res.status(400).json({ error: "providerAccountId is required" });
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
