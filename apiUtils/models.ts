import { getUserProfile, listPopularModelsFromSnapshots } from "@knut/db";
import { getOptionalUser } from "./auth";
import { convertPopularModelsPayload } from "./currency";

type ApiRequest = {
  method?: string;
  headers: {
    authorization?: string;
  };
};

type ApiResponse = {
  status(code: number): {
    json(body: unknown): unknown;
  };
};

function emptyModelsPayload(warning: string) {
  return {
    models: [],
    refreshedAt: new Date().toISOString(),
    sources: ["Model data fallback"],
    warning
  };
}

export async function handleModelsRequest(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const [models, user] = await Promise.all([
      listPopularModelsFromSnapshots(50),
      getOptionalUser(req)
    ]);
    const profile = user ? await getUserProfile(user.id) : null;
    const payload = {
      models,
      refreshedAt: new Date().toISOString(),
      sources: [
        "Pricing snapshots",
        "Artificial Analysis benchmark snapshots"
      ]
    };
    const convertedPayload = await convertPopularModelsPayload(payload, profile?.preferredCurrency ?? "USD");

    return res.status(200).json(convertedPayload);
  } catch (error) {
    return res.status(200).json(emptyModelsPayload(error instanceof Error ? error.message : "Model data refresh failed"));
  }
}
