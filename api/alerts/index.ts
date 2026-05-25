import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listAlertsForUser } from "@knut/db";
import { requireUser } from "../auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);
    return res.status(200).json({
      alerts: await listAlertsForUser(user.id)
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not load alerts."
    });
  }
}
