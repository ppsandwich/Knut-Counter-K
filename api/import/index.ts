import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createUsageRecords } from "@knut/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  const result = await createUsageRecords(records);
  return res.status(200).json({ ok: true, ...result });
}
