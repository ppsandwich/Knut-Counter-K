use crate::api::{ApiClient, CompanionSyncPayload};
use crate::config::Config;
use crate::providers::{ProviderData, ProviderExtractor};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SyncEngine {
    config: Arc<Mutex<Config>>,
    api: ApiClient,
    providers: Vec<Box<dyn ProviderExtractor>>,
    last_sync: Arc<Mutex<Option<SyncResult>>>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncResult {
    pub synced_at: String,
    pub providers_synced: usize,
    pub errors: Vec<String>,
}

impl SyncEngine {
    pub fn new(config: Config) -> Self {
        let api = ApiClient::new(&config.api_url);
        
        Self {
            config: Arc::new(Mutex::new(config)),
            api,
            providers: Vec::new(),
            last_sync: Arc::new(Mutex::new(None)),
        }
    }

    /// Register a provider extractor
    pub fn add_provider(&mut self, provider: Box<dyn ProviderExtractor>) {
        self.providers.push(provider);
    }

    /// Get list of available providers
    pub fn available_providers(&self) -> Vec<(&str, &str, bool)> {
        self.providers
            .iter()
            .map(|p| (p.provider_id(), p.name(), p.is_available()))
            .collect()
    }

    /// Run sync for all enabled providers
    pub async fn sync_all(&self) -> anyhow::Result<SyncResult> {
        let config = self.config.lock().await;
        
        let auth_token = config.auth_token.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;

        let mut provider_data: Vec<ProviderData> = Vec::new();
        let mut errors: Vec<String> = Vec::new();

        for provider in &self.providers {
            // Check if provider is enabled
            if !config.enabled_providers.contains(&provider.provider_id().to_string()) {
                continue;
            }

            // Check if provider is available
            if !provider.is_available() {
                errors.push(format!("{}: credentials not found", provider.name()));
                continue;
            }

            match provider.extract().await {
                Ok(data) => provider_data.push(data),
                Err(e) => errors.push(format!("{}: {}", provider.name(), e)),
            }
        }

        if !provider_data.is_empty() {
            let payload = CompanionSyncPayload {
                companion_version: env!("CARGO_PKG_VERSION").to_string(),
                synced_at: Utc::now().to_rfc3339(),
                providers: provider_data.iter().map(|p| p.to_sync()).collect(),
            };

            self.api.sync_providers(auth_token, &payload).await?;
        }

        let result = SyncResult {
            synced_at: Utc::now().to_rfc3339(),
            providers_synced: provider_data.len(),
            errors,
        };

        *self.last_sync.lock().await = Some(result.clone());
        Ok(result)
    }

    /// Get the last sync result
    pub async fn last_sync(&self) -> Option<SyncResult> {
        self.last_sync.lock().await.clone()
    }

    /// Get current config
    pub async fn config(&self) -> Config {
        self.config.lock().await.clone()
    }

    /// Update config
    pub async fn update_config(&self, new_config: Config) -> anyhow::Result<()> {
        new_config.save()?;
        *self.config.lock().await = new_config;
        Ok(())
    }
}
