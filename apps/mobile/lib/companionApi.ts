/**
 * Companion API client for web app
 * 
 * Handles communication with the Knut Sync companion app
 * through the Knut Counter API.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "";

/**
 * Authorize a device code from the companion app
 */
export async function authorizeDeviceCode(userCode: string, userId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/companion?action=authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_code: userCode, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Authorization failed");
  }

  const result = await response.json();
  return result.authorized === true;
}

/**
 * Get companion connection status
 */
export async function getCompanionStatus(): Promise<{
  connected: boolean;
  lastSync: string | null;
  devices: Array<{ id: string; name: string; lastSeen: string }>;
}> {
  const response = await fetch(`${API_BASE}/api/companion?action=status`, {
    method: "GET",
  });

  if (!response.ok) {
    return { connected: false, lastSync: null, devices: [] };
  }

  return response.json();
}

/**
 * Revoke companion access
 */
export async function revokeCompanionAccess(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/companion?action=revoke`, {
    method: "POST",
  });

  return response.ok;
}
