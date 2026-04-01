// src-tauri/src/commands/ai_commands.rs
//! Tauri commands for AI integration.
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::storage::conversation::{ConversationStorage, Conversation, ConversationSummary};
use crate::sidecar::SidecarManager;
use crate::config::KeyringManager;
use crate::error::Result;

/// Type alias for SidecarManager wrapped in Arc<Mutex<>> for Tauri State.
pub type SidecarState = Arc<Mutex<SidecarManager>>;

/// Type alias for ConversationStorage wrapped in Arc<Mutex<>> for Tauri State.
pub type StorageState = Arc<Mutex<ConversationStorage>>;

/// Provider configuration stored in config file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigData {
    pub model: String,
    pub base_url: Option<String>,
}

/// Save an API key for a provider.
#[tauri::command]
pub async fn save_api_key(provider: String, key: String) -> Result<()> {
    let keyring = KeyringManager::new();
    keyring.save_api_key(&provider, &key)
}

/// Get an API key for a provider.
#[tauri::command]
pub async fn get_api_key(provider: String) -> Result<Option<String>> {
    let keyring = KeyringManager::new();
    match keyring.get_api_key(&provider) {
        Ok(key) => Ok(Some(key)),
        Err(_) => Ok(None),
    }
}

/// Delete an API key for a provider.
#[tauri::command]
pub async fn delete_api_key(provider: String) -> Result<()> {
    let keyring = KeyringManager::new();
    keyring.delete_api_key(&provider)
}

/// Save provider configuration (model, base_url)
#[tauri::command]
pub async fn save_provider_config(provider: String, config: ProviderConfigData) -> Result<()> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::error::AppError::Storage("Cannot find config directory".to_string()))?;
    let app_config_dir = config_dir.join("DropMind");
    std::fs::create_dir_all(&app_config_dir)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to create config dir: {}", e)))?;

    let config_file = app_config_dir.join("provider_configs.json");

    // Load existing configs
    let mut configs: std::collections::HashMap<String, ProviderConfigData> = if config_file.exists() {
        let content = std::fs::read_to_string(&config_file)
            .map_err(|e| crate::error::AppError::Storage(format!("Failed to read config: {}", e)))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    // Update the provider config
    configs.insert(provider, config);

    // Save back
    let content = serde_json::to_string_pretty(&configs)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;
    std::fs::write(&config_file, content)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to write config: {}", e)))?;

    Ok(())
}

/// Get provider configuration
#[tauri::command]
pub async fn get_provider_config(provider: String) -> Result<Option<ProviderConfigData>> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::error::AppError::Storage("Cannot find config directory".to_string()))?;
    let config_file = config_dir.join("DropMind").join("provider_configs.json");

    if !config_file.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&config_file)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read config: {}", e)))?;

    let configs: std::collections::HashMap<String, ProviderConfigData> = serde_json::from_str(&content)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;

    Ok(configs.get(&provider).cloned())
}

/// Send a message to the sidecar and receive a response.
#[tauri::command]
pub async fn send_to_sidecar(
    message: serde_json::Value,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value> {
    let mut manager = sidecar.lock().await;
    let response = manager.send_and_receive(message).await?;
    Ok(response)
}

/// Save a conversation.
#[tauri::command]
pub async fn save_conversation(
    conversation: Conversation,
    storage: State<'_, StorageState>,
) -> Result<()> {
    let storage = storage.lock().await;
    storage.save(&conversation)
}

/// Load a conversation by ID.
#[tauri::command]
pub async fn load_conversation(
    id: String,
    storage: State<'_, StorageState>,
) -> Result<Conversation> {
    let storage = storage.lock().await;
    storage.load(&id)
}

/// List all conversation summaries.
#[tauri::command]
pub async fn list_conversations(
    storage: State<'_, StorageState>,
) -> Result<Vec<ConversationSummary>> {
    let storage = storage.lock().await;
    storage.list()
}

/// Delete a conversation by ID.
#[tauri::command]
pub async fn delete_conversation(
    id: String,
    storage: State<'_, StorageState>,
) -> Result<()> {
    let storage = storage.lock().await;
    storage.delete(&id)
}

/// Save a knowledge framework to storage.
#[tauri::command]
pub async fn save_framework(
    framework: serde_json::Value,
    storage: State<'_, StorageState>,
    drop_storage: State<'_, crate::commands::DropStorageState>,
) -> Result<()> {
    // Extract framework ID, defaulting to "default" if not present
    let id = framework["id"].as_str().unwrap_or("default").to_string();
    let content = serde_json::to_string_pretty(&framework)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;

    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;

    let frameworks_dir = base_path.join("frameworks");
    std::fs::create_dir_all(&frameworks_dir)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to create frameworks dir: {}", e)))?;

    let file_path = frameworks_dir.join(format!("{}.json", id));
    std::fs::write(&file_path, content)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to write framework: {}", e)))?;

    // Drop the storage lock before acquiring drop_storage lock (avoid deadlock)
    drop(storage);

    // Write back related_framework_ids to referenced drops
    let drop_ids = framework["createdFromDrops"].as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_default();

    if !drop_ids.is_empty() {
        let drop_storage = drop_storage.lock().await;
        for drop_id_str in &drop_ids {
            if let Ok(drop_uuid) = uuid::Uuid::parse_str(drop_id_str) {
                if let Ok(Some(mut drop)) = drop_storage.get(drop_uuid) {
                    // Add framework ID if not already present
                    let needs_update = !drop.metadata.related_framework_ids.iter().any(|rid| rid.to_string() == id);
                    if needs_update {
                        if let Ok(fw_uuid) = uuid::Uuid::parse_str(&id) {
                            drop.metadata.related_framework_ids.push(fw_uuid);
                        }
                    }
                    // Mark drop as processed
                    drop.status = crate::models::DropStatus::Processed;
                    let _ = drop_storage.update(drop);
                }
            }
        }
    }

    Ok(())
}

/// Load a knowledge framework from storage.
#[tauri::command]
pub async fn load_framework(
    id: String,
    storage: State<'_, StorageState>,
) -> Result<Option<serde_json::Value>> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;

    let frameworks_dir = base_path.join("frameworks");
    let file_path = frameworks_dir.join(format!("{}.json", id));

    if !file_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read framework: {}", e)))?;

    let framework: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;

    Ok(Some(framework))
}

/// Delete a framework by ID.
#[tauri::command]
pub async fn delete_framework(
    id: String,
    storage: State<'_, StorageState>,
) -> Result<()> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;

    let frameworks_dir = base_path.join("frameworks");
    let file_path = frameworks_dir.join(format!("{}.json", id));

    if !file_path.exists() {
        return Err(crate::error::AppError::Storage(format!("Framework not found: {}", id)));
    }

    std::fs::remove_file(&file_path)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to delete framework: {}", e)))?;

    Ok(())
}

/// List all saved framework IDs.
#[tauri::command]
pub async fn list_frameworks(
    storage: State<'_, StorageState>,
) -> Result<Vec<String>> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;

    let frameworks_dir = base_path.join("frameworks");

    if !frameworks_dir.exists() {
        return Ok(Vec::new());
    }

    let mut framework_ids = Vec::new();
    for entry in std::fs::read_dir(&frameworks_dir)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read frameworks dir: {}", e)))?
    {
        let entry = entry.map_err(|e| crate::error::AppError::Storage(e.to_string()))?;
        let path = entry.path();

        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Some(stem) = path.file_stem() {
                if let Some(id) = stem.to_str() {
                    framework_ids.push(id.to_string());
                }
            }
        }
    }

    framework_ids.sort();
    Ok(framework_ids)
}

/// Drop info for framework summary display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropInfo {
    pub id: String,
    pub preview: String,
    pub content_type: String,
}

/// Framework summary for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub lifecycle: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub created_from_drops: Vec<DropInfo>,
    pub created_at: String,
    pub updated_at: String,
}

/// List all saved frameworks with summary info.
#[tauri::command]
pub async fn list_framework_summaries(
    storage: State<'_, StorageState>,
    drop_storage: State<'_, crate::commands::DropStorageState>,
) -> Result<Vec<FrameworkSummary>> {
    // Phase 1: Collect all framework data (hold storage lock briefly)
    let raw_frameworks: Vec<(String, serde_json::Value)> = {
        let storage = storage.lock().await;
        let base_path = storage.base_path().parent()
            .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;

        let frameworks_dir = base_path.join("frameworks");
        if !frameworks_dir.exists() {
            return Ok(Vec::new());
        }

        let mut result = Vec::new();
        for entry in std::fs::read_dir(&frameworks_dir)
            .map_err(|e| crate::error::AppError::Storage(format!("Failed to read dir: {}", e)))?
        {
            let entry = entry.map_err(|e| crate::error::AppError::Storage(e.to_string()))?;
            let path = entry.path();

            if path.extension().map(|e| e == "json").unwrap_or(false) {
                let content = std::fs::read_to_string(&path)
                    .map_err(|e| crate::error::AppError::Storage(format!("Failed to read: {}", e)))?;
                let fw: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
                let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                result.push((id, fw));
            }
        }
        result
    }; // storage lock dropped here

    // Phase 2: Resolve drop details (hold drop_storage lock briefly)
    let ds = drop_storage.lock().await;

    let summaries: Vec<FrameworkSummary> = raw_frameworks.into_iter().map(|(_file_id, fw)| {
        let drop_ids: Vec<String> = fw["createdFromDrops"].as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let drop_infos: Vec<DropInfo> = drop_ids.iter().filter_map(|did| {
            uuid::Uuid::parse_str(did).ok().and_then(|uuid| {
                ds.get(uuid).ok().flatten().map(|d| {
                    let preview = match &d.content {
                        crate::models::DropContent::Text { text } => text.chars().take(100).collect(),
                        crate::models::DropContent::Url { url, .. } => url.clone(),
                        crate::models::DropContent::Image { path, .. } => path.display().to_string(),
                        crate::models::DropContent::File { path, .. } => path.display().to_string(),
                        crate::models::DropContent::Voice { path, .. } => path.display().to_string(),
                    };
                    let content_type = match &d.content {
                        crate::models::DropContent::Text { .. } => "text".to_string(),
                        crate::models::DropContent::Url { .. } => "url".to_string(),
                        crate::models::DropContent::Image { .. } => "image".to_string(),
                        crate::models::DropContent::File { .. } => "file".to_string(),
                        crate::models::DropContent::Voice { .. } => "voice".to_string(),
                    };
                    DropInfo { id: did.clone(), preview, content_type }
                })
            })
        }).collect();

        FrameworkSummary {
            id: fw["id"].as_str().unwrap_or("").to_string(),
            title: fw["title"].as_str().unwrap_or("未命名").to_string(),
            description: fw["description"].as_str().unwrap_or("").to_string(),
            lifecycle: fw["lifecycle"].as_str().unwrap_or("draft").to_string(),
            node_count: fw["nodes"].as_array().map(|a| a.len()).unwrap_or(0),
            edge_count: fw["edges"].as_array().map(|a| a.len()).unwrap_or(0),
            created_from_drops: drop_infos,
            created_at: fw["createdAt"].as_str().unwrap_or("").to_string(),
            updated_at: fw["updatedAt"].as_str().unwrap_or("").to_string(),
        }
    }).collect();

    let mut sorted = summaries;
    sorted.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sorted)
}

// Re-export PromptConfig from direct_ai for use in commands
pub use super::direct_ai::PromptConfig;

/// Save prompt configuration
#[tauri::command]
pub async fn save_prompt_config(config: PromptConfig) -> Result<()> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::error::AppError::Storage("Cannot find config directory".to_string()))?;
    let app_config_dir = config_dir.join("DropMind");
    std::fs::create_dir_all(&app_config_dir)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to create config dir: {}", e)))?;

    let config_file = app_config_dir.join("prompt_config.json");
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| crate::error::AppError::Serialization(e.to_string()))?;
    std::fs::write(&config_file, content)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to write config: {}", e)))?;

    Ok(())
}

/// Get prompt configuration
#[tauri::command]
pub async fn get_prompt_config() -> Result<PromptConfig> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::error::AppError::Storage("Cannot find config directory".to_string()))?;
    let config_file = config_dir.join("DropMind").join("prompt_config.json");

    if !config_file.exists() {
        return Ok(PromptConfig::default());
    }

    let content = std::fs::read_to_string(&config_file)
        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read config: {}", e)))?;

    let config: PromptConfig = serde_json::from_str(&content)
        .unwrap_or_else(|_| PromptConfig::default());

    Ok(config)
}
