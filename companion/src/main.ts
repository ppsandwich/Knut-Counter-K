// @ts-ignore - Tauri API injected at runtime
const { invoke } = window.__TAURI__?.core || { invoke: async () => {} };

// Types
interface Config {
  api_url: string;
  auth_token: string | null;
  user_id: string | null;
  sync_interval_minutes: number;
  enabled_providers: string[];
  auto_start: boolean;
}

interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
}

interface DeviceAuthInfo {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

interface AuthResult {
  status: string;
  user_id: string | null;
}

interface SyncResult {
  synced_at: string;
  providers_synced: number;
  errors: string[];
}

// State
let config: Config | null = null;
let providers: ProviderInfo[] = [];
let pollInterval: number | null = null;

// Elements
const authCard = document.getElementById('auth-card')!;
const providersCard = document.getElementById('providers-card')!;
const syncCard = document.getElementById('sync-card')!;
const providerList = document.getElementById('provider-list')!;
const syncStatus = document.getElementById('sync-status')!;
const syncInfo = document.getElementById('sync-info')!;
const syncBtn = document.getElementById('sync-btn')!;

// Initialize
async function init() {
  config = await invoke('get_config') as Config;
  providers = await invoke('get_providers') as ProviderInfo[];
  
  renderAuth();
  renderProviders();
  
  if (config?.auth_token) {
    showAuthenticated();
    const lastSync = await invoke('get_last_sync') as SyncResult | null;
    if (lastSync) {
      updateSyncStatus(lastSync);
    }
  }
}

// Auth UI
function renderAuth() {
  if (config?.auth_token) {
    authCard.innerHTML = `
      <div class="card-header">
        <span class="card-title">Account</span>
        <span class="status status-connected">
          <span class="status-dot"></span>
          <span>Connected</span>
        </span>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
        Signed in as user ${config.user_id?.substring(0, 8)}...
      </p>
      <button class="btn btn-danger btn-block" onclick="logout()">Disconnect</button>
    `;
  } else {
    authCard.innerHTML = `
      <div class="card-header">
        <span class="card-title">Account</span>
        <span class="status status-disconnected">
          <span class="status-dot"></span>
          <span>Not connected</span>
        </span>
      </div>
      <div class="auth-section">
        <p>Connect Knut Sync to your Knut Counter account to sync subscription usage data.</p>
        <button class="btn btn-primary" onclick="startAuth()">Connect Account</button>
      </div>
    `;
  }
}

// Start device auth flow
async function startAuth() {
  const authInfo = await invoke('start_device_auth') as DeviceAuthInfo;
  
  authCard.innerHTML = `
    <div class="card-header">
      <span class="card-title">Connect Account</span>
    </div>
    <div class="device-code">
      <div class="code">${authInfo.user_code}</div>
      <div class="instructions">
        Visit <a href="${authInfo.verification_uri}" target="_blank">${authInfo.verification_uri}</a><br>
        and enter the code above
      </div>
    </div>
    <p style="font-size: 12px; color: var(--text-dim); text-align: center;">
      Waiting for authorization... (${authInfo.expires_in}s remaining)
    </p>
  `;

  // Poll for completion
  pollInterval = window.setInterval(async () => {
    try {
      const result = await invoke('poll_device_auth', { deviceCode: authInfo.device_code }) as AuthResult;
      
      if (result.status === 'authenticated') {
        clearInterval(pollInterval!);
        pollInterval = null;
        
        config = await invoke('get_config');
        renderAuth();
        showAuthenticated();
      } else if (result.status.startsWith('error')) {
        clearInterval(pollInterval!);
        pollInterval = null;
        
        authCard.innerHTML += `<p style="color: var(--red); margin-top: 12px;">${result.status}</p>`;
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, 2000);
}

// Logout
async function logout() {
  await invoke('logout');
  config = await invoke('get_config');
  renderAuth();
  hideAuthenticated();
}

// Show authenticated UI
function showAuthenticated() {
  providersCard.style.display = 'block';
  syncCard.style.display = 'block';
}

// Hide authenticated UI
function hideAuthenticated() {
  providersCard.style.display = 'none';
  syncCard.style.display = 'none';
}

// Render providers
function renderProviders() {
  providerList.innerHTML = providers.map(p => `
    <li class="provider-item">
      <div class="provider-info">
        <div class="provider-icon">${getProviderIcon(p.id)}</div>
        <div>
          <div class="provider-name">${p.name}</div>
          <div class="provider-status">${p.available ? 'Credentials found' : 'Not installed'}</div>
        </div>
      </div>
      <div class="toggle ${config?.enabled_providers.includes(p.id) ? 'active' : ''}" 
           data-provider="${p.id}"
           onclick="toggleProvider('${p.id}')">
      </div>
    </li>
  `).join('');
}

// Get provider icon
function getProviderIcon(id: string): string {
  const icons: Record<string, string> = {
    anthropic_api: '🟠',
    openai_api: '🟢',
    google_gemini_api: '🔵',
    github_copilot: '⚫',
    cursor: '🟡',
    antigravity: '🟣',
  };
  return icons[id] || '⚪';
}

// Toggle provider
async function toggleProvider(id: string) {
  if (!config) return;
  
  const index = config.enabled_providers.indexOf(id);
  if (index >= 0) {
    config.enabled_providers.splice(index, 1);
  } else {
    config.enabled_providers.push(id);
  }
  
  await invoke('update_config', { newConfig: config });
  renderProviders();
}

// Sync now
async function syncNow() {
  (syncBtn as HTMLButtonElement).disabled = true;
  syncBtn.textContent = 'Syncing...';
  syncStatus.className = 'status status-syncing';
  syncStatus.innerHTML = '<span class="status-dot"></span><span>Syncing...</span>';
  
  try {
    const result = await invoke('sync_now') as SyncResult;
    updateSyncStatus(result);
  } catch (e) {
    console.error('Sync error:', e);
    syncStatus.className = 'status status-disconnected';
    syncStatus.innerHTML = '<span class="status-dot"></span><span>Sync failed</span>';
  } finally {
    (syncBtn as HTMLButtonElement).disabled = false;
    syncBtn.textContent = 'Sync Now';
  }
}

// Update sync status
function updateSyncStatus(result: SyncResult) {
  const date = new Date(result.synced_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  syncStatus.className = 'status status-connected';
  syncStatus.innerHTML = '<span class="status-dot"></span><span>Synced</span>';
  
  syncInfo.innerHTML = `
    Last synced: <span class="time">${timeStr}</span><br>
    ${result.providers_synced} provider(s) synced
    ${result.errors.length > 0 ? `<br><span style="color: var(--orange);">${result.errors.length} warning(s)</span>` : ''}
  `;
}

// Sync button handler
syncBtn.addEventListener('click', syncNow);

// Make functions available globally
(window as any).startAuth = startAuth;
(window as any).logout = logout;
(window as any).toggleProvider = toggleProvider;

// Initialize
init();
