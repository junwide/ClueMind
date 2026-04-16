// src-tauri/src/commands/sync_commands.rs
//! Tauri commands for sync configuration, server connectivity, and sync execution.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Emitter, State};
use crate::config::KeyringManager;
use crate::error::Result;
use crate::sync::sync_engine::{SyncEngine, SyncStatus};
use crate::sync::sync_client::SyncClient;

/// Shared state for the sync engine.
pub type SyncEngineState = Arc<Mutex<Option<SyncEngine>>>;

/// Sync configuration (stored as JSON, separate from AppConfig TOML).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    #[serde(default)]
    pub server_url: Option<String>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_sync_interval")]
    pub auto_sync_interval_minutes: u64,
}

fn default_sync_interval() -> u64 { 30 }

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            server_url: None,
            enabled: false,
            auto_sync_interval_minutes: default_sync_interval(),
        }
    }
}

const KEYRING_KEY: &str = "sync_server";

/// Resolve config directory for DropMind sync config.
fn sync_config_path() -> Option<std::path::PathBuf> {
    dirs::config_dir().map(|d| d.join("DropMind").join("sync_config.json"))
}

/// Ensure the config directory exists.
fn ensure_config_dir() -> Result<std::path::PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::error::AppError::Storage("Cannot find config directory".to_string()))?;
    let app_config_dir = config_dir.join("DropMind");
    std::fs::create_dir_all(&app_config_dir)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to create config dir: {}", e)))?;
    Ok(app_config_dir)
}

/// Save sync configuration.
#[tauri::command]
pub async fn save_sync_config(
    server_url: Option<String>,
    enabled: bool,
    auto_sync_interval_minutes: u64,
) -> Result<()> {
    let config_dir = ensure_config_dir()?;
    let config_file = config_dir.join("sync_config.json");
    let data = SyncConfig {
        server_url,
        enabled,
        auto_sync_interval_minutes,
    };
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;
    std::fs::write(&config_file, content)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to write sync config: {}", e)))?;

    Ok(())
}

/// Get sync configuration.
#[tauri::command]
pub async fn get_sync_config() -> Result<SyncConfig> {
    let config_file = match sync_config_path() {
        Some(p) => p,
        None => return Ok(SyncConfig::default()),
    };

    if !config_file.exists() {
        return Ok(SyncConfig::default());
    }

    let content = std::fs::read_to_string(&config_file)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read sync config: {}", e)))?;

    let config: SyncConfig = serde_json::from_str(&content)
        .unwrap_or_default();

    Ok(config)
}

/// Save sync server auth token (stored securely in keyring).
#[tauri::command]
pub async fn save_sync_token(token: String) -> Result<()> {
    let keyring = KeyringManager::new();
    keyring.save_api_key(KEYRING_KEY, &token)
}

/// Get sync server auth token.
#[tauri::command]
pub async fn get_sync_token() -> Result<Option<String>> {
    let keyring = KeyringManager::new();
    match keyring.get_api_key(KEYRING_KEY) {
        Ok(key) => Ok(Some(key)),
        Err(_) => Ok(None),
    }
}

/// Delete sync server auth token.
#[tauri::command]
pub async fn delete_sync_token() -> Result<()> {
    let keyring = KeyringManager::new();
    keyring.delete_api_key(KEYRING_KEY)
}

/// Test connection to the sync server using SyncClient.
#[tauri::command]
pub async fn test_server_connection(server_url: String, token: String) -> Result<String> {
    let client = SyncClient::new(&server_url, &token);
    client.health_check().await
}

/// Rebuild the SyncEngine from current config (called after saving config).
/// This enables hot-reload without restarting the app.
#[tauri::command]
pub async fn rebuild_sync_engine(
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = app.emit("sync-config-changed", ());
    Ok(())
}

/// Execute a sync cycle now. Uses try_lock to avoid blocking if auto-sync is running.
#[tauri::command]
pub async fn sync_now(
    sync_engine: State<'_, SyncEngineState>,
    app: tauri::AppHandle,
) -> Result<SyncStatus> {
    let engine_guard = sync_engine.try_lock()
        .map_err(|_| crate::error::AppError::Storage("Sync already in progress".to_string()))?;

    let engine = engine_guard.as_ref()
        .ok_or_else(|| crate::error::AppError::Storage("Sync not configured".to_string()))?;

    let status = engine.sync().await?;

    // Emit event so frontend can update
    if let Err(e) = app.emit("sync-status-changed", &status) {
        tracing::warn!("Failed to emit sync-status-changed: {}", e);
    }

    Ok(status)
}

/// Get the current sync status from the sync meta file.
#[tauri::command]
pub async fn get_sync_status(
    sync_engine: State<'_, SyncEngineState>,
) -> Result<SyncStatus> {
    let engine_guard = sync_engine.lock().await;

    match engine_guard.as_ref() {
        Some(engine) => {
            let meta_path = engine.data_dir().join("sync_meta.json");
            if meta_path.exists() {
                let content = std::fs::read_to_string(&meta_path)
                    .map_err(|e| crate::error::AppError::Storage(format!("Failed to read sync meta: {}", e)))?;
                let meta: serde_json::Value = serde_json::from_str(&content)
                    .unwrap_or_default();
                Ok(SyncStatus {
                    last_sync_at: meta["lastSyncAt"].as_str()
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&chrono::Utc)),
                    is_syncing: false,
                    last_error: None,
                    pushed_count: meta["pushedCount"].as_u64().unwrap_or(0) as usize,
                    pulled_count: meta["pulledCount"].as_u64().unwrap_or(0) as usize,
                    conflict_count: meta["conflictCount"].as_u64().unwrap_or(0) as usize,
                })
            } else {
                Ok(SyncStatus::default())
            }
        }
        None => Ok(SyncStatus::default()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_config_data_default() {
        let config = SyncConfig::default();
        assert!(config.server_url.is_none());
        assert!(!config.enabled);
        assert_eq!(config.auto_sync_interval_minutes, 30);
    }

    #[test]
    fn test_sync_config_data_serialization() {
        let config = SyncConfig {
            server_url: Some("http://localhost:3817".to_string()),
            enabled: true,
            auto_sync_interval_minutes: 15,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("localhost"));

        let parsed: SyncConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.server_url, Some("http://localhost:3817".to_string()));
        assert!(parsed.enabled);
        assert_eq!(parsed.auto_sync_interval_minutes, 15);
    }

    #[test]
    fn test_sync_config_data_backward_compat() {
        let json = r#"{}"#;
        let parsed: SyncConfig = serde_json::from_str(json).unwrap();
        assert!(parsed.server_url.is_none());
        assert!(!parsed.enabled);
    }
}
