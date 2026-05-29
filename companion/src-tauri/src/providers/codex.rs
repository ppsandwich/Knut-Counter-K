use super::{ExtractedCredit, ExtractedLimit, ProviderData, ProviderExtractor};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct CodexAuth {
    access_token: Option<String>,
    #[serde(rename = "accessToken")]
    access_token_alt: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageResponse {
    #[serde(rename = "five_hour")]
    five_hour: Option<UsageWindow>,
    #[serde(rename = "seven_day")]
    seven_day: Option<UsageWindow>,
    #[serde(rename = "rate_limit_tier")]
    rate_limit_tier: Option<String>,
    #[serde(rename = "subscriptionType")]
    subscription_type: Option<String>,
    credits: Option<CreditsInfo>,
}

#[derive(Debug, Deserialize)]
struct UsageWindow {
    utilization: f64,
    limit: f64,
    #[serde(rename = "resetsAt")]
    resets_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreditsInfo {
    balance: f64,
    #[serde(rename = "hasCredits")]
    has_credits: bool,
    unlimited: Option<bool>,
}

pub struct CodexExtractor {
    client: Client,
}

impl CodexExtractor {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    fn credentials_path() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        
        // Check CODEX_HOME first, then default to ~/.codex
        if let Ok(codex_home) = std::env::var("CODEX_HOME") {
            return PathBuf::from(codex_home).join("auth.json");
        }
        
        home.join(".codex").join("auth.json")
    }

    fn load_credentials(&self) -> anyhow::Result<Option<CodexAuth>> {
        let path = Self::credentials_path();
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path)?;
        let auth: CodexAuth = serde_json::from_str(&content)?;
        Ok(Some(auth))
    }

    fn get_access_token(auth: &CodexAuth) -> Option<&str> {
        auth.access_token.as_deref()
            .or(auth.access_token_alt.as_deref())
    }

    async fn fetch_usage(&self, access_token: &str) -> anyhow::Result<UsageResponse> {
        let resp = self.client
            .get("https://chatgpt.com/backend-api/wham/usage")
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "KnutSync/0.1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Codex API error ({}): {}", status, body);
        }

        Ok(resp.json().await?)
    }

    fn infer_plan(usage: &UsageResponse) -> Option<String> {
        if let Some(ref sub_type) = usage.subscription_type {
            return Some(sub_type.clone());
        }
        if let Some(ref tier) = usage.rate_limit_tier {
            return Some(match tier.as_str() {
                "plus" => "chatgpt_plus".to_string(),
                "pro" => "chatgpt_pro".to_string(),
                "team" => "chatgpt_team".to_string(),
                "enterprise" => "chatgpt_enterprise".to_string(),
                _ => tier.clone(),
            });
        }
        None
    }
}

#[async_trait::async_trait]
impl ProviderExtractor for CodexExtractor {
    fn provider_id(&self) -> &str {
        "openai_api"
    }

    fn name(&self) -> &str {
        "Codex / ChatGPT"
    }

    fn is_available(&self) -> bool {
        Self::credentials_path().exists()
    }

    async fn extract(&self) -> anyhow::Result<ProviderData> {
        let auth = self.load_credentials()?
            .ok_or_else(|| anyhow::anyhow!("No Codex credentials found"))?;

        let access_token = Self::get_access_token(&auth)
            .ok_or_else(|| anyhow::anyhow!("No access token in Codex credentials"))?
            .to_string();

        let usage = self.fetch_usage(&access_token).await?;
        let plan = Self::infer_plan(&usage);

        let mut limits = Vec::new();

        // 5-hour session window (Codex rate limit)
        if let Some(ref window) = usage.five_hour {
            limits.push(ExtractedLimit {
                limit_type: "codex_5h".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "requests".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        // Weekly window
        if let Some(ref window) = usage.seven_day {
            limits.push(ExtractedLimit {
                limit_type: "codex_weekly".to_string(),
                used: window.utilization,
                limit: window.limit,
                unit: "requests".to_string(),
                resets_at: window.resets_at.as_ref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            });
        }

        // Credits
        let credits = usage.credits.as_ref().and_then(|c| {
            if c.has_credits || c.unlimited.unwrap_or(false) {
                Some(ExtractedCredit {
                    balance: c.balance,
                    currency: "USD".to_string(),
                })
            } else {
                None
            }
        });

        Ok(ProviderData {
            provider_id: self.provider_id().to_string(),
            subscription_plan: plan,
            limits,
            credits,
        })
    }
}
