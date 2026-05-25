import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteProviderCredentials } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireUser(req);

    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providerAccountId = String(req.query.providerAccountId ?? req.body?.providerAccountId ?? "");
    if (!providerAccountId) {
      return res.status(400).json({ error: "providerAccountId is required" });
    }

    const result = await deleteProviderCredentials(user.id, providerAccountId);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
