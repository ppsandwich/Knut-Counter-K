use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_url: String,
    pub auth_token: Option<String>,
    pub user_id: Option<String>,
    pub sync_interval_minutes: u32,
    pub enabled_providers: Vec<String>,
    pub auto_start: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_url: "https://knut-counter.vercel.app".to_string(),
            auth_token: None,
            user_id: None,
            sync_interval_minutes: 15,
            enabled_providers: vec![],
            auto_start: false,
        }
    }
}

impl Config {
    pub fn config_path() -> PathBuf {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("knut-sync");
        std::fs::create_dir_all(&config_dir).ok();
        config_dir.join("config.toml")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            toml::from_str(&content).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::config_path();
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    pub fn is_authenticated(&self) -> bool {
        self.auth_token.is_some()
    }
}
