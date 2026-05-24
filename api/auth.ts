import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export type AuthenticatedUser = {
  id: string;
  email: string;
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user.email) {
    throw new Error("Invalid session.");
  }

  return {
    id: data.user.id,
    email: data.user.email
  };
}
