use super::{ExtractedLimit, ProviderData, ProviderExtractor};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::process::Command;

#[derive(Debug, Deserialize)]
struct QuotaSnapshot {
    #[serde(rename = "planType")]
    plan_type: Option<String>,
    #[serde(rename = "promptCredits")]
    prompt_credits: Option<PromptCredits>,
    models: Option<Vec<ModelQuota>>,
}

#[derive(Debug, Deserialize)]
struct PromptCredits {
    available: f64,
    monthly: f64,
    #[serde(rename = "remainingPercentage")]
    remaining_percentage: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ModelQuota {
    label: String,
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "remainingPercentage")]
    remaining_percentage: Option<f64>,
    #[serde(rename = "isExhausted")]
    is_exhausted: Option<bool>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
    #[serde(rename = "isAutocompleteOnly")]
    is_autocomplete_only: Option<bool>,
}

pub struct AntigravityExtractor;

impl AntigravityExtractor {
    pub fn new() -> Self {
        Self
    }

    fn is_installed() -> bool {
        Command::new("antigravity-usage")
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    fn run_cli() -> anyhow::Result<String> {
        let output = Command::new("antigravity-usage")
            .arg("--json")
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("antigravity-usage failed: {}", stderr);
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

#[async_trait::async_trait]
impl ProviderExtractor for AntigravityExtractor {
    fn provider_id(&self) -> &str {
        "antigravity"
    }

    fn name(&self) -> &str {
        "Antigravity"
    }

    fn is_available(&self) -> bool {
        Self::is_installed()
    }

    async fn extract(&self) -> anyhow::Result<ProviderData> {
        let json_str = Self::run_cli()?;
        let snapshot: QuotaSnapshot = serde_json::from_str(&json_str)?;

        let mut limits = Vec::new();

        // Per-model quotas
        if let Some(ref models) = snapshot.models {
            for model in models {
                if model.is_autocomplete_only.unwrap_or(false) {
                    continue;
                }

                let remaining = model.remaining_percentage.unwrap_or(0.0);
                let used = (100.0 - remaining).max(0.0);
                let resets_at = model.reset_time.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                limits.push(ExtractedLimit {
                    limit_type: format!("antigravity_{}", model.model_id),
                    used,
                    limit: 100.0,
                    unit: "percent".to_string(),
                    resets_at,
                });
            }
        }

        Ok(ProviderData {
            provider_id: self.provider_id().to_string(),
            subscription_plan: snapshot.plan_type,
            limits,
            credits: None,
        })
    }
}
