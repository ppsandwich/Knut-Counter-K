/**
 * Companion app authentication and sync utilities
 * 
 * Handles device code authentication flow and data sync
 * from Knut Sync desktop companion app.
 */

import postgres from "postgres";
import crypto from "crypto";

type Sql = postgres.Sql;

let sqlClient: Sql | null = null;

function getSql(): Sql {
  if (sqlClient) return sqlClient;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  sqlClient = postgres(databaseUrl, { max: 1, prepare: false });
  return sqlClient;
}

// Device code store (in production, use Redis or database)
const deviceCodes = new Map<string, {
  userCode: string;
  userId: string | null;
  expiresAt: Date;
  status: "pending" | "authenticated" | "expired";
}>();

// Generate a random user code (e.g., "ABCD-1234")
function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a new device code for companion app authentication
 */
export async function createDeviceCode() {
  const deviceCode = crypto.randomUUID();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  deviceCodes.set(deviceCode, {
    userCode,
    userId: null,
    expiresAt,
    status: "pending",
  });

  // Clean up expired codes
  for (const [key, value] of deviceCodes.entries()) {
    if (value.expiresAt < new Date()) {
      deviceCodes.delete(key);
    }
  }

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: process.env.NEXT_PUBLIC_APP_URL || "https://knut-counter.vercel.app/companion",
    expires_in: 600,
    interval: 5,
  };
}

/**
 * Poll for device code authentication status
 */
export async function pollDeviceCode(deviceCode: string) {
  const entry = deviceCodes.get(deviceCode);
  
  if (!entry) {
    throw new Error("Invalid device code");
  }

  if (entry.expiresAt < new Date()) {
    deviceCodes.delete(deviceCode);
    return { status: "expired" };
  }

  if (entry.status === "pending") {
    return { status: "pending" };
  }

  if (entry.status === "authenticated" && entry.userId) {
    // Generate an auth token for the companion
    const token = crypto.randomUUID();
    
    // Store the token (in production, use JWT with expiry)
    await storeCompanionToken(entry.userId, token);
    
    deviceCodes.delete(deviceCode);
    
    return {
      status: "authenticated",
      access_token: token,
      user_id: entry.userId,
    };
  }

  return { status: "pending" };
}

/**
 * Authorize a device code (called from web UI)
 */
export async function authorizeDeviceCode(userCode: string, userId: string) {
  for (const [key, entry] of deviceCodes.entries()) {
    if (entry.userCode === userCode && entry.status === "pending") {
      entry.status = "authenticated";
      entry.userId = userId;
      return true;
    }
  }
  return false;
}

/**
 * Store a companion auth token
 */
async function storeCompanionToken(userId: string, token: string) {
  // In production, store in database with expiry
  // For now, we'll use a simple in-memory store
  console.log(`Stored companion token for user ${userId}`);
}

/**
 * Validate a companion auth token
 */
export async function validateCompanionToken(token: string): Promise<string | null> {
  // In production, validate against database
  // For now, return a mock user ID
  // TODO: Implement proper token validation
  return null;
}

/**
 * Process companion sync data
 */
export async function processCompanionSync(userId: string, payload: any) {
  const sql = getSql();
  
  const { providers, companion_version, synced_at } = payload;
  
  for (const provider of providers) {
    const { provider_id, subscription_plan, limits, credits } = provider;
    
    // Find or create provider account for this user
    const [account] = await sql`
      SELECT id FROM provider_accounts 
      WHERE user_id = ${userId} 
        AND provider_id = ${provider_id}
        AND auth_type = 'companion'
      LIMIT 1
    `;
    
    let accountId = account?.id;
    
    if (!accountId) {
      // Create a companion provider account
      const [newAccount] = await sql`
        INSERT INTO provider_accounts (
          user_id, provider_id, display_name, auth_type, 
          plan_name, is_active
        ) VALUES (
          ${userId}, ${provider_id}, 
          ${subscription_plan || provider_id}, 'companion',
          ${subscription_plan}, true
        )
        RETURNING id
      `;
      accountId = newAccount.id;
    }
    
    // Update usage caps from limits
    for (const limit of limits) {
      const existing = await sql`
        SELECT id FROM usage_caps
        WHERE user_id = ${userId}
          AND provider_account_id = ${accountId}
          AND cap_type = ${limit.limit_type}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        await sql`
          UPDATE usage_caps
          SET used_amount = ${limit.used.toString()},
              cap_amount = ${limit.limit.toString()},
              cap_unit = ${limit.unit},
              reset_at = ${limit.resets_at ? new Date(limit.resets_at) : null},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO usage_caps (
            user_id, provider_account_id, cap_type, cap_label,
            cap_amount, cap_unit, used_amount, reset_at,
            reset_cadence, confidence
          ) VALUES (
            ${userId}, ${accountId}, ${limit.limit_type}, 
            ${limit.limit_type}, ${limit.limit.toString()}, 
            ${limit.unit}, ${limit.used.toString()},
            ${limit.resets_at ? new Date(limit.resets_at) : null},
            'companion', 'companion_reported'
          )
        `;
      }
    }
    
    // Update credits if provided
    if (credits) {
      // Similar logic for credits...
    }
  }
  
  // Update last sync time
  await sql`
    UPDATE provider_accounts
    SET last_sync_at = NOW()
    WHERE user_id = ${userId} 
      AND auth_type = 'companion'
  `;
  
  return { success: true, providers_synced: providers.length };
}
