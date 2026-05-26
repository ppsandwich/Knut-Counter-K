import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleModelsRequest } from "../apiUtils/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleModelsRequest(req, res);
}
