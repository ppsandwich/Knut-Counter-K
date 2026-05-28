import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleRegistryRequest } from "../../apiUtils/registry";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleRegistryRequest(req, res);
}
