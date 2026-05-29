import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleRegistryRequest } from "../apiUtils/registry";
import { handleSyncRequest } from "../apiUtils/sync";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  // GET /api/providers?action=registry
  if (req.method === "GET" && action === "registry") {
    return handleRegistryRequest(req, res);
  }

  // POST /api/providers?action=sync
  if (req.method === "POST" && action === "sync") {
    return handleSyncRequest(req, res);
  }

  return res.status(400).json({ error: "Invalid action. Use: registry, sync" });
}
