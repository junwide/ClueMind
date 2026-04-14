// src-tauri/src/commands/ai_commands.rs
//! Tauri commands for AI integration.
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::storage::conversation::{ConversationStorage, Conversation, ConversationSummary};
use crate::config::KeyringManager;
use crate::error::Result;
use crate::storage::index::FrameworkIndexParams;

/// Type alias for ConversationStorage wrapped in Arc<Mutex<>> for Tauri State.
pub type StorageState = Arc<Mutex<ConversationStorage>>;

/// Re-export StorageIndexState from drop_commands
pub use super::drop_commands::StorageIndexState;

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
    index: State<'_, StorageIndexState>,
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
                    drop_storage.update(drop)
                        .map_err(|e| tracing::warn!("Failed to update drop {}: {}", id, e)).ok();
                }
            }
        }
    }

    // Update SQLite framework index
    let title = framework["title"].as_str().unwrap_or("").to_string();
    let description = framework["description"].as_str().unwrap_or("").to_string();
    let structure_type = framework["structureType"].as_str()
        .or_else(|| framework["structure_type"].as_str())
        .unwrap_or("custom");
    let lifecycle = framework["lifecycle"].as_str().unwrap_or("draft");
    let node_count = framework["nodes"].as_array().map(|a| a.len()).unwrap_or(0);
    let edge_count = framework["edges"].as_array().map(|a| a.len()).unwrap_or(0);
    let drop_count = framework["createdFromDrops"].as_array()
        .or_else(|| framework["created_from_drops"].as_array())
        .map(|a| a.len()).unwrap_or(0);
    let created_at = framework["createdAt"].as_str()
        .or_else(|| framework["created_at"].as_str())
        .unwrap_or("");
    let updated_at = framework["updatedAt"].as_str()
        .or_else(|| framework["updated_at"].as_str())
        .unwrap_or("");

    if let Err(e) = index.index_framework(&FrameworkIndexParams {
        id: &id, title: &title, description: &description,
        structure_type, lifecycle,
        node_count, edge_count, drop_count, created_at, updated_at,
    }) {
        tracing::warn!("Failed to index framework {}: {}", id, e);
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
    index: State<'_, StorageIndexState>,
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

    // Remove from SQLite index
    if let Err(e) = index.remove_framework(&id) {
        tracing::warn!("Failed to remove framework {} from index: {}", id, e);
    }

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

/// Node in the framework relationship graph (Mindscape View)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkGraphNode {
    pub id: String,
    pub title: String,
    pub description: String,
    pub lifecycle: String,
    pub structure_type: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub drop_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

/// Edge representing shared drops between two frameworks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedDropEdge {
    pub source_id: String,
    pub target_id: String,
    pub shared_drop_count: usize,
    pub shared_drop_ids: Vec<String>,
}

/// Complete framework graph data for Mindscape View
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkGraphData {
    pub nodes: Vec<FrameworkGraphNode>,
    pub edges: Vec<SharedDropEdge>,
}

/// List all frameworks as a graph with computed shared-drop relationships.
#[tauri::command]
pub async fn list_framework_graph(
    storage: State<'_, StorageState>,
    drop_storage: State<'_, crate::commands::DropStorageState>,
) -> Result<FrameworkGraphData> {
    use std::collections::HashMap;

    // Phase 1: Scan all frameworks
    let raw_frameworks: Vec<(String, serde_json::Value)> = {
        let storage = storage.lock().await;
        let base_path = storage.base_path().parent()
            .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;
        let frameworks_dir = base_path.join("frameworks");
        if !frameworks_dir.exists() {
            return Ok(FrameworkGraphData { nodes: Vec::new(), edges: Vec::new() });
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
    }; // storage lock dropped

    // Phase 2: Build framework nodes
    let nodes: Vec<FrameworkGraphNode> = raw_frameworks.iter().map(|(_file_id, fw)| {
        let drop_count = fw["createdFromDrops"].as_array()
            .map(|a| a.len())
            .unwrap_or(0);
        FrameworkGraphNode {
            id: fw["id"].as_str().unwrap_or("").to_string(),
            title: fw["title"].as_str().unwrap_or("未命名").to_string(),
            description: fw["description"].as_str().unwrap_or("").to_string(),
            lifecycle: fw["lifecycle"].as_str().unwrap_or("draft").to_string(),
            structure_type: fw["structureType"].as_str()
                .or_else(|| fw["structure_type"].as_str())
                .unwrap_or("custom").to_string(),
            node_count: fw["nodes"].as_array().map(|a| a.len()).unwrap_or(0),
            edge_count: fw["edges"].as_array().map(|a| a.len()).unwrap_or(0),
            drop_count,
            created_at: fw["createdAt"].as_str().unwrap_or("").to_string(),
            updated_at: fw["updatedAt"].as_str().unwrap_or("").to_string(),
        }
    }).collect();

    // Phase 3: Scan drops to find cross-framework relationships
    let ds = drop_storage.lock().await;
    let mut pair_map: HashMap<(String, String), Vec<String>> = HashMap::new();

    // Iterate all drops and find those linked to multiple frameworks
    let all_drops = ds.list().map_err(|e| crate::error::AppError::Storage(e.to_string()))?;
    for drop_entry in &all_drops {
        let related = &drop_entry.metadata.related_framework_ids;
        if related.len() < 2 {
            continue;
        }
        // Generate all pairwise combinations
        let ids: Vec<String> = related.iter().map(|u| u.to_string()).collect();
        for i in 0..ids.len() {
            for j in (i + 1)..ids.len() {
                let mut pair = (ids[i].clone(), ids[j].clone());
                // Normalize: always smaller id first
                if pair.0 > pair.1 {
                    std::mem::swap(&mut pair.0, &mut pair.1);
                }
                pair_map.entry(pair).or_default().push(drop_entry.id.to_string());
            }
        }
    }
    drop(ds); // release lock

    // Phase 4: Build edges from pair_map
    let edges: Vec<SharedDropEdge> = pair_map.into_iter().map(|((source_id, target_id), shared_drop_ids)| {
        SharedDropEdge {
            source_id,
            target_id,
            shared_drop_count: shared_drop_ids.len(),
            shared_drop_ids,
        }
    }).collect();

    Ok(FrameworkGraphData { nodes, edges })
}

/// Node in the material graph (Drop or Framework)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialGraphNode {
    pub id: String,
    pub label: String,
    pub content_type: String,
}

/// Edge connecting a Drop to a Framework
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialGraphEdge {
    pub drop_id: String,
    pub framework_id: String,
}

/// Material graph data for Mindscape Material View
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialGraphData {
    pub drops: Vec<MaterialGraphNode>,
    pub frameworks: Vec<MaterialGraphNode>,
    pub edges: Vec<MaterialGraphEdge>,
}

/// List all drops linked to frameworks as a bipartite graph.
#[tauri::command]
pub async fn list_material_graph(
    storage: State<'_, StorageState>,
    drop_storage: State<'_, crate::commands::DropStorageState>,
) -> Result<MaterialGraphData> {
    // Collect all drops with at least one framework reference
    let ds = drop_storage.lock().await;
    let all_drops = ds.list().map_err(|e| crate::error::AppError::Storage(e.to_string()))?;
    let mut framework_ids_set = std::collections::HashSet::new();

    let drop_nodes: Vec<MaterialGraphNode> = all_drops.iter()
        .filter(|d| !d.metadata.related_framework_ids.is_empty())
        .map(|d| {
            for fid in &d.metadata.related_framework_ids {
                framework_ids_set.insert(fid.to_string());
            }
            let preview = match &d.content {
                crate::models::DropContent::Text { text } => {
                    let s = text.chars().take(80).collect::<String>();
                    if text.len() > 80 { format!("{}…", s) } else { s }
                }
                crate::models::DropContent::Url { url, .. } => url.clone(),
                crate::models::DropContent::Image { .. } => "[Image]".to_string(),
                crate::models::DropContent::File { .. } => "[File]".to_string(),
                crate::models::DropContent::Voice { .. } => "[Voice]".to_string(),
            };
            let ct = match &d.content {
                crate::models::DropContent::Text { .. } => "text",
                crate::models::DropContent::Url { .. } => "url",
                crate::models::DropContent::Image { .. } => "image",
                crate::models::DropContent::File { .. } => "file",
                crate::models::DropContent::Voice { .. } => "voice",
            };
            MaterialGraphNode {
                id: d.id.to_string(),
                label: preview,
                content_type: ct.to_string(),
            }
        })
        .collect();

    let edges: Vec<MaterialGraphEdge> = all_drops.iter()
        .flat_map(|d| {
            d.metadata.related_framework_ids.iter().map(|fid| MaterialGraphEdge {
                drop_id: d.id.to_string(),
                framework_id: fid.to_string(),
            }).collect::<Vec<_>>()
        })
        .collect();
    drop(ds); // release lock

    // Collect framework nodes
    let framework_nodes = {
        let s = storage.lock().await;
        let base_path = s.base_path().parent()
            .ok_or_else(|| crate::error::AppError::Storage("Invalid base path".to_string()))?;
        let frameworks_dir = base_path.join("frameworks");
        let mut result = Vec::new();
        if frameworks_dir.exists() {
            for entry in std::fs::read_dir(&frameworks_dir)
                .map_err(|e| crate::error::AppError::Storage(format!("Failed to read dir: {}", e)))?
            {
                let entry = entry.map_err(|e| crate::error::AppError::Storage(e.to_string()))?;
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    let content = std::fs::read_to_string(&path)
                        .map_err(|e| crate::error::AppError::Storage(format!("Failed to read: {}", e)))?;
                    let fw: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
                    let id = fw["id"].as_str().unwrap_or("").to_string();
                    if framework_ids_set.contains(&id) {
                        result.push(MaterialGraphNode {
                            id,
                            label: fw["title"].as_str().unwrap_or("未命名").to_string(),
                            content_type: "framework".to_string(),
                        });
                    }
                }
            }
        }
        result
    };

    Ok(MaterialGraphData {
        drops: drop_nodes,
        frameworks: framework_nodes,
        edges,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_config_data_serialization() {
        let config = ProviderConfigData {
            model: "gpt-4o".to_string(),
            base_url: Some("https://api.openai.com".to_string()),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("gpt-4o"));
        assert!(json.contains("https://api.openai.com"));

        let parsed: ProviderConfigData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.model, "gpt-4o");
        assert_eq!(parsed.base_url.unwrap(), "https://api.openai.com");
    }

    #[test]
    fn test_provider_config_data_no_base_url() {
        let config = ProviderConfigData {
            model: "glm-4-plus".to_string(),
            base_url: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        let parsed: ProviderConfigData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.model, "glm-4-plus");
        assert!(parsed.base_url.is_none());
    }

    #[test]
    fn test_framework_graph_node_serialization() {
        let node = FrameworkGraphNode {
            id: "fw-1".to_string(),
            title: "My Framework".to_string(),
            description: "A test framework".to_string(),
            lifecycle: "building".to_string(),
            structure_type: "pyramid".to_string(),
            node_count: 5,
            edge_count: 3,
            drop_count: 2,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-02T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&node).unwrap();

        // Verify camelCase serialization
        assert!(json.contains("nodeCount"), "Expected camelCase nodeCount");
        assert!(json.contains("edgeCount"), "Expected camelCase edgeCount");
        assert!(json.contains("dropCount"), "Expected camelCase dropCount");
        assert!(json.contains("createdAt"), "Expected camelCase createdAt");
        assert!(json.contains("updatedAt"), "Expected camelCase updatedAt");
        assert!(!json.contains("sourceId"), "Should not contain sourceId");

        let parsed: FrameworkGraphNode = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "fw-1");
        assert_eq!(parsed.node_count, 5);
        assert_eq!(parsed.edge_count, 3);
        assert_eq!(parsed.drop_count, 2);
    }

    #[test]
    fn test_shared_drop_edge_serialization() {
        let edge = SharedDropEdge {
            source_id: "fw-1".to_string(),
            target_id: "fw-2".to_string(),
            shared_drop_count: 3,
            shared_drop_ids: vec!["drop-1".to_string(), "drop-2".to_string(), "drop-3".to_string()],
        };

        let json = serde_json::to_string(&edge).unwrap();

        // Verify camelCase
        assert!(json.contains("sourceId"), "Expected camelCase sourceId");
        assert!(json.contains("targetId"), "Expected camelCase targetId");
        assert!(json.contains("sharedDropCount"), "Expected camelCase sharedDropCount");
        assert!(json.contains("sharedDropIds"), "Expected camelCase sharedDropIds");

        let parsed: SharedDropEdge = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.source_id, "fw-1");
        assert_eq!(parsed.target_id, "fw-2");
        assert_eq!(parsed.shared_drop_count, 3);
        assert_eq!(parsed.shared_drop_ids.len(), 3);
    }

    #[test]
    fn test_framework_graph_data_construction() {
        let data = FrameworkGraphData {
            nodes: vec![
                FrameworkGraphNode {
                    id: "fw-1".to_string(),
                    title: "First".to_string(),
                    description: String::new(),
                    lifecycle: "draft".to_string(),
                    structure_type: "pyramid".to_string(),
                    node_count: 1,
                    edge_count: 0,
                    drop_count: 1,
                    created_at: "2024-01-01T00:00:00Z".to_string(),
                    updated_at: "2024-01-01T00:00:00Z".to_string(),
                },
                FrameworkGraphNode {
                    id: "fw-2".to_string(),
                    title: "Second".to_string(),
                    description: String::new(),
                    lifecycle: "confirmed".to_string(),
                    structure_type: "pillars".to_string(),
                    node_count: 3,
                    edge_count: 2,
                    drop_count: 0,
                    created_at: "2024-01-02T00:00:00Z".to_string(),
                    updated_at: "2024-01-02T00:00:00Z".to_string(),
                },
            ],
            edges: vec![SharedDropEdge {
                source_id: "fw-1".to_string(),
                target_id: "fw-2".to_string(),
                shared_drop_count: 1,
                shared_drop_ids: vec!["drop-1".to_string()],
            }],
        };

        let json = serde_json::to_string(&data).unwrap();
        let parsed: FrameworkGraphData = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.nodes.len(), 2);
        assert_eq!(parsed.edges.len(), 1);
        assert_eq!(parsed.nodes[0].title, "First");
        assert_eq!(parsed.nodes[1].title, "Second");
        assert_eq!(parsed.edges[0].shared_drop_count, 1);
    }

    #[test]
    fn test_framework_graph_data_empty() {
        let data = FrameworkGraphData {
            nodes: vec![],
            edges: vec![],
        };

        let json = serde_json::to_string(&data).unwrap();
        let parsed: FrameworkGraphData = serde_json::from_str(&json).unwrap();
        assert!(parsed.nodes.is_empty());
        assert!(parsed.edges.is_empty());
    }

    #[test]
    fn test_material_graph_node_serialization() {
        let node = MaterialGraphNode {
            id: "drop-1".to_string(),
            label: "Some text...".to_string(),
            content_type: "text".to_string(),
        };
        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("contentType"), "Expected camelCase contentType");
        let parsed: MaterialGraphNode = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "drop-1");
        assert_eq!(parsed.content_type, "text");
    }

    #[test]
    fn test_material_graph_data_construction() {
        let data = MaterialGraphData {
            drops: vec![MaterialGraphNode {
                id: "d1".to_string(),
                label: "preview".to_string(),
                content_type: "text".to_string(),
            }],
            frameworks: vec![MaterialGraphNode {
                id: "fw1".to_string(),
                label: "My FW".to_string(),
                content_type: "framework".to_string(),
            }],
            edges: vec![MaterialGraphEdge {
                drop_id: "d1".to_string(),
                framework_id: "fw1".to_string(),
            }],
        };
        let json = serde_json::to_string(&data).unwrap();
        let parsed: MaterialGraphData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.drops.len(), 1);
        assert_eq!(parsed.frameworks.len(), 1);
        assert_eq!(parsed.edges.len(), 1);
        assert_eq!(parsed.edges[0].drop_id, "d1");
        assert_eq!(parsed.edges[0].framework_id, "fw1");
    }

    #[test]
    fn test_drop_info_serialization() {
        let info = DropInfo {
            id: "drop-1".to_string(),
            preview: "Some preview text...".to_string(),
            content_type: "text".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        let parsed: DropInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "drop-1");
        assert_eq!(parsed.preview, "Some preview text...");
        assert_eq!(parsed.content_type, "text");
    }

    #[test]
    fn test_framework_summary_serialization() {
        let summary = FrameworkSummary {
            id: "fw-1".to_string(),
            title: "Test".to_string(),
            description: "Desc".to_string(),
            lifecycle: "building".to_string(),
            node_count: 2,
            edge_count: 1,
            created_from_drops: vec![
                DropInfo {
                    id: "d-1".to_string(),
                    preview: "preview".to_string(),
                    content_type: "url".to_string(),
                },
            ],
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&summary).unwrap();
        let parsed: FrameworkSummary = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, "fw-1");
        assert_eq!(parsed.node_count, 2);
        assert_eq!(parsed.edge_count, 1);
        assert_eq!(parsed.created_from_drops.len(), 1);
        assert_eq!(parsed.created_from_drops[0].content_type, "url");
    }
}
