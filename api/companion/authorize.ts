import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authorizeDeviceCode } from "../../apiUtils/companion";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_code, user_id } = req.body;

    if (!user_code || !user_id) {
      return res.status(400).json({ error: "user_code and user_id required" });
    }

    const authorized = await authorizeDeviceCode(user_code, user_id);

    if (authorized) {
      return res.status(200).json({ authorized: true });
    } else {
      return res.status(404).json({ 
        authorized: false, 
        error: "Invalid or expired code" 
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal error" 
    });
  }
}
