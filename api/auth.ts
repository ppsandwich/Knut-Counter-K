import type { VercelRequest } from "@vercel/node";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

type SupabaseAuthUserResponse = {
  id?: string;
  email?: string;
};

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function requireUser(req: VercelRequest): Promise<AuthenticatedUser> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = getBearerToken(req);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment is not configured.");
  }

  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Invalid session.");
  }

  const data = (await response.json()) as SupabaseAuthUserResponse;
  if (!data.id || !data.email) {
    throw new Error("Invalid session user.");
  }

  return {
    id: data.id,
    email: data.email
  };
}
