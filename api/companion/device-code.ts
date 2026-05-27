import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createDeviceCode, pollDeviceCode } from "../../apiUtils/companion";

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
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal error" });
  }
}
