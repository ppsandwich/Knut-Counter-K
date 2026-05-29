import { listProviderRegistryOptions } from "@knut/db";
import { requireUser } from "./auth";

export async function handleRegistryRequest(req: any, res: any) {
  try {
    await requireUser(req);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providers = await listProviderRegistryOptions();
    return res.status(200).json({ ok: true, providers });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
