pub mod antigravity;
pub mod claude;
pub mod codex;

use crate::api::{LimitSync, ProviderSync, CreditSync};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderData {
    pub provider_id: String,
    pub subscription_plan: Option<String>,
    pub limits: Vec<ExtractedLimit>,
    pub credits: Option<ExtractedCredit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedLimit {
    pub limit_type: String,
    pub used: f64,
    pub limit: f64,
    pub unit: String,
    pub resets_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedCredit {
    pub balance: f64,
    pub currency: String,
}

impl ProviderData {
    pub fn to_sync(&self) -> ProviderSync {
        ProviderSync {
            provider_id: self.provider_id.clone(),
            subscription_plan: self.subscription_plan.clone(),
            limits: self.limits.iter().map(|l| LimitSync {
                limit_type: l.limit_type.clone(),
                used: l.used,
                limit: l.limit,
                unit: l.unit.clone(),
                resets_at: l.resets_at.map(|dt| dt.to_rfc3339()),
            }).collect(),
            credits: self.credits.as_ref().map(|c| CreditSync {
                balance: c.balance,
                currency: c.currency.clone(),
            }),
        }
    }
}

/// Trait for provider extractors
#[async_trait::async_trait]
pub trait ProviderExtractor: Send + Sync {
    /// Provider identifier
    fn provider_id(&self) -> &str;
    
    /// Human-readable name
    fn name(&self) -> &str;
    
    /// Check if this provider is available (credentials exist)
    fn is_available(&self) -> bool;
    
    /// Extract current usage data
    async fn extract(&self) -> anyhow::Result<ProviderData>;
}
