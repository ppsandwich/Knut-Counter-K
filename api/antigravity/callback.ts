import type { VercelRequest, VercelResponse } from "@vercel/node";
import { upsertProviderAccountWithCredentials } from "@knut/db";
import { requireUser } from "../../apiUtils/auth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      return res.redirect(`/?antigravity_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    return res.redirect(`/antigravity-callback?code=${encodeURIComponent(code)}`);
  }

  if (req.method === "POST") {
    const { code } = req.body as { code?: string };

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const clientId = process.env.GOOGLE_CLOUDCODE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLOUDCODE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CLOUDCODE_REDIRECT_URI ?? `https://${req.headers.host}/api/antigravity/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Google OAuth is not configured on the server." });
    }

    let userId: string;
    try {
      const user = await requireUser(req);
      userId = user.id;
    } catch {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        return res.status(400).json({ error: `Token exchange failed: ${body}` });
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const stored = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000
      };

      const result = await upsertProviderAccountWithCredentials(
        userId,
        "antigravity",
        "Antigravity",
        "oauth",
        JSON.stringify(stored)
      );

      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : "OAuth callback failed."
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
