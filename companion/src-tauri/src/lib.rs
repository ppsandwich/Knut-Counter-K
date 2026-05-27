mod api;
mod config;
mod providers;
mod sync;

use api::ApiClient;
use config::Config;
use providers::claude::ClaudeExtractor;
use providers::codex::CodexExtractor;
use sync::{SyncEngine, SyncResult};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

struct AppState {
    sync_engine: Arc<Mutex<SyncEngine>>,
}

#[tauri::command]
async fn get_config(state: State<'_, AppState>) -> Result<Config, String> {
    let engine = state.sync_engine.lock().await;
    Ok(engine.config().await)
}

#[tauri::command]
async fn update_config(state: State<'_, AppState>, new_config: Config) -> Result<(), String> {
    let engine = state.sync_engine.lock().await;
    engine.update_config(new_config).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_providers(state: State<'_, AppState>) -> Result<Vec<ProviderInfo>, String> {
    let engine = state.sync_engine.lock().await;
    Ok(engine.available_providers()
        .into_iter()
        .map(|(id, name, available)| ProviderInfo {
            id: id.to_string(),
            name: name.to_string(),
            available,
        })
        .collect())
}

#[derive(serde::Serialize)]
struct ProviderInfo {
    id: String,
    name: String,
    available: bool,
}

#[tauri::command]
async fn start_device_auth(state: State<'_, AppState>) -> Result<DeviceAuthInfo, String> {
    let engine = state.sync_engine.lock().await;
    let config = engine.config().await;
    let api = ApiClient::new(&config.api_url);
    
    let response = api.start_device_auth().await.map_err(|e| e.to_string())?;
    
    Ok(DeviceAuthInfo {
        device_code: response.device_code,
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        expires_in: response.expires_in,
    })
}

#[derive(serde::Serialize)]
struct DeviceAuthInfo {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
}

#[tauri::command]
async fn poll_device_auth(state: State<'_, AppState>, device_code: String) -> Result<AuthResult, String> {
    let engine = state.sync_engine.lock().await;
    let config = engine.config().await;
    let api = ApiClient::new(&config.api_url);
    
    match api.poll_device_auth(&device_code).await {
        Ok(Some(token_response)) => {
            let user_id = token_response.user_id.clone();
            let mut new_config = config.clone();
            new_config.auth_token = Some(token_response.access_token);
            new_config.user_id = Some(token_response.user_id);
            engine.update_config(new_config).await.map_err(|e| e.to_string())?;
            
            Ok(AuthResult {
                status: "authenticated".to_string(),
                user_id: Some(user_id),
            })
        }
        Ok(None) => Ok(AuthResult {
            status: "pending".to_string(),
            user_id: None,
        }),
        Err(e) => Ok(AuthResult {
            status: format!("error: {}", e),
            user_id: None,
        }),
    }
}

#[derive(serde::Serialize)]
struct AuthResult {
    status: String,
    user_id: Option<String>,
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let engine = state.sync_engine.lock().await;
    let mut config = engine.config().await;
    config.auth_token = None;
    config.user_id = None;
    engine.update_config(config).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn sync_now(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let engine = state.sync_engine.lock().await;
    engine.sync_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_last_sync(state: State<'_, AppState>) -> Result<Option<SyncResult>, String> {
    let engine = state.sync_engine.lock().await;
    Ok(engine.last_sync().await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = Config::load();
    let mut sync_engine = SyncEngine::new(config);
    
    // Register providers
    sync_engine.add_provider(Box::new(ClaudeExtractor::new()));
    sync_engine.add_provider(Box::new(CodexExtractor::new()));
    // TODO: Add more providers (Cursor, Copilot, etc.)
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            sync_engine: Arc::new(Mutex::new(sync_engine)),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            update_config,
            get_providers,
            start_device_auth,
            poll_device_auth,
            logout,
            sync_now,
            get_last_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
