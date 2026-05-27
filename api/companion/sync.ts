import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateCompanionToken, processCompanionSync } from "../../apiUtils/companion";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const userId = await validateCompanionToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Process sync payload
    const payload = req.body;
    if (!payload?.providers || !Array.isArray(payload.providers)) {
      return res.status(400).json({ error: "Invalid payload: providers array required" });
    }

    const result = await processCompanionSync(userId, payload);
    
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal error" });
  }
}
