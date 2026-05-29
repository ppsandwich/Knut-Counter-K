import type { VercelRequest, VercelResponse } from "@vercel/node";
import { 
  createDeviceCode, 
  pollDeviceCode, 
  authorizeDeviceCode, 
  validateCompanionToken, 
  processCompanionSync 
} from "../apiUtils/companion";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  try {
    // GET /api/companion?action=status
    if (req.method === "GET" && action === "status") {
      return res.status(200).json({ 
        status: "ok",
        version: "1.0.0"
      });
    }

    // POST /api/companion?action=device-code
    if (req.method === "POST" && action === "device-code") {
      const { device_code } = req.body || {};

      if (device_code) {
        // Poll for existing device code
        const result = await pollDeviceCode(device_code);
        
        if (result.status === "authenticated") {
          return res.status(200).json(result);
        } else if (result.status === "expired") {
          return res.status(428).json({ error: "Device code expired" });
        } else {
          return res.status(202).json({ status: "pending" });
        }
      } else {
        // Create new device code
        const result = await createDeviceCode();
        return res.status(200).json(result);
      }
    }

    // POST /api/companion?action=authorize
    if (req.method === "POST" && action === "authorize") {
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
    }

    // POST /api/companion?action=sync
    if (req.method === "POST" && action === "sync") {
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
    }

    // Default: action not found
    return res.status(400).json({ error: "Invalid action. Use: device-code, authorize, sync, status" });

  } catch (error) {
    console.error("Companion API error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal error" 
    });
  }
}
