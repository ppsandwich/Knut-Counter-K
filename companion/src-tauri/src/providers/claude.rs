use super::{ExtractedLimit, ProviderData, ProviderExtractor};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct ClaudeCredentials {
    #[serde(rename = "accessToken")]
    access_token: Option<String>,
    #[serde(rename = "refreshToken")]
    refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageResponse {
    #[serde(rename = "five_hour")]
    five_hour: Option<UsageWindow>,
    #[serde(rename = "seven_day")]
    seven_day: Option<UsageWindow>,
    #[serde(rename = "seven_day_sonnet")]
    seven_day_sonnet: Option<UsageWindow>,
    #[serde(rename = "seven_day_opus")]
    seven_day_opus: Option<UsageWindow>,
    #[serde(rename = "subscriptionType")]
    subscription_type: Option<String>,
    #[serde(rename = "rate_limit_tier")]
    rate_limit_tier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageWindow {
    #[serde(rename = "utilization")]
    utilization: f64,
    #[serde(rename = "limit")]
    limit: f64,
    #[serde(rename = "resetsAt")]
    resets_at: Option<String>,
}

pub struct ClaudeExtractor {
    client: Client,
}

impl ClaudeExtractor {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    fn credentials_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
            .join(".credentials.json")
    }

    fn load_credentials(&self) -> anyhow::Result<Option<ClaudeCredentials>> {
        let path = Self::credentials_path();
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path)?;
        let creds: ClaudeCredentials = serde_json::from_str(&content)?;
        Ok(Some(creds))
    }

    async fn fetch_usage(&self, access_token: &str) -> anyhow::Result<UsageResponse> {
        let resp = self.client
            .get("https://api.anthropic.com/api/oauth/usage")
            .header("Authorization", format!("Bearer {}", access_token))
            .header("anthropic-beta", "oauth-2025-04-20")
            .send()
            .await?;

        if !resp.status().is_success() {
            anyhow::bail!("Claude API error: {}", resp.status());
        }

        Ok(resp.json().await?)
    }

    fn infer_plan(usage: &UsageResponse) -> Option<String> {
        if let Some(ref sub_type) = usage.subscription_type {
            return Some(sub_type.clone());
        }
        if let Some(ref tier) = usage.rate_limit_tier {
            return Some(match tier.as_str() {
                "max" => "claude_max".to_string(),
                "pro" => "claude_pro".to_string(),
                "team" => "claude_team".to_string(),
                "enterprise" => "claude_enterprise".to_string(),
                _ => tier.clone(),
            });
        }
        None
    }
}

#[async_trait::async_trait]
impl ProviderExtractor for ClaudeExtractor {
    fn provider_id(&self) -> &str {
        "anthropic_api"
    }

    fn name(&self) -> &str {
        "Claude"
    }

    fn is_available(&self) -> bool {
        Self::credentials_path().exists()
    }

    async fn extract(&self) -> anyhow::Result<ProviderData> {
        let creds = self.load_credentials()?
            .ok_or_else(|| anyhow::anyhow!("No Claude credentials found"))?;

        let access_token = creds.access_token
            .ok_or_else(|| anyhow::anyhow!("No access token in Claude credentials"))?;

        let usage = self.fetch_usage(&access_token).await?;
        let plan = Self::infer_plan(&usage);

        let mut limits = Vec::new();

        // 5-hour session window
        if let Some(ref window) = usage.five_hour {
            limits.push(ExtractedLimit {
                limit_type: "messages_5h".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "messages".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        // Weekly window
        if let Some(ref window) = usage.seven_day {
            limits.push(ExtractedLimit {
                limit_type: "messages_weekly".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "messages".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        // Sonnet weekly
        if let Some(ref window) = usage.seven_day_sonnet {
            limits.push(ExtractedLimit {
                limit_type: "messages_weekly_sonnet".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "messages".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        // Opus weekly
        if let Some(ref window) = usage.seven_day_opus {
            limits.push(ExtractedLimit {
                limit_type: "messages_weekly_opus".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "messages".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        Ok(ProviderData {
            provider_id: self.provider_id().to_string(),
            subscription_plan: plan,
            limits,
            credits: None,
        })
    }
}
