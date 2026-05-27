import { markProviderAccountsSynced } from "@knut/db";
import { requireUser } from "./auth";

export async function handleSyncRequest(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);
    const providerAccountId = req.body?.providerAccountId ? String(req.body.providerAccountId) : undefined;
    const result = await markProviderAccountsSynced(user.id, providerAccountId);

    return res.status(200).json({
      ok: true,
      ...result,
      message: result.message || (result.synced
        ? "Refresh recorded."
        : "No active provider accounts matched this refresh.")
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Provider sync failed."
    });
  }
}
