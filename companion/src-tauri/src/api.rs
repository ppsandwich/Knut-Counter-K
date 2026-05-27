use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionSyncPayload {
    pub companion_version: String,
    pub synced_at: String,
    pub providers: Vec<ProviderSync>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSync {
    pub provider_id: String,
    pub subscription_plan: Option<String>,
    pub limits: Vec<LimitSync>,
    pub credits: Option<CreditSync>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitSync {
    pub limit_type: String,
    pub used: f64,
    pub limit: f64,
    pub unit: String,
    pub resets_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditSync {
    pub balance: f64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub user_id: String,
}

pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    /// Start device code authentication flow
    pub async fn start_device_auth(&self) -> anyhow::Result<DeviceCodeResponse> {
        let url = format!("{}/api/companion?action=device-code", self.base_url);
        let resp = self.client.post(&url).send().await?;
        
        if !resp.status().is_success() {
            anyhow::bail!("Failed to start device auth: {}", resp.status());
        }
        
        Ok(resp.json().await?)
    }

    /// Poll for device code completion
    pub async fn poll_device_auth(&self, device_code: &str) -> anyhow::Result<Option<TokenResponse>> {
        let url = format!("{}/api/companion?action=device-code", self.base_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({ "device_code": device_code }))
            .send()
            .await?;
        
        match resp.status().as_u16() {
            200 => Ok(Some(resp.json().await?)),
            202 => Ok(None), // Still pending
            428 => anyhow::bail!("Device code expired"),
            _ => anyhow::bail!("Unexpected status: {}", resp.status()),
        }
    }

    /// Sync provider data to Knut Counter
    pub async fn sync_providers(
        &self,
        auth_token: &str,
        payload: &CompanionSyncPayload,
    ) -> anyhow::Result<()> {
        let url = format!("{}/api/companion?action=sync", self.base_url);
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .json(payload)
            .send()
            .await?;
        
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Sync failed: {}", body);
        }
        
        Ok(())
    }
}
