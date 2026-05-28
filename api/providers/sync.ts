import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSyncRequest } from "../../apiUtils/sync";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleSyncRequest(req, res);
}
