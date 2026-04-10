// src-tauri/src/commands/drop_commands.rs
//! Tauri commands for Drop operations.
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use crate::storage::{DropStorage, StorageIndex, DropSearchResult, PaginatedResult, AssetManager};
use crate::models::{Drop, DropContent, DropStatus};
use crate::error::Result;
use uuid::Uuid;

/// Type alias for DropStorage wrapped in Arc<Mutex<>> for Tauri State.
pub type DropStorageState = Arc<Mutex<DropStorage>>;

/// Type alias for StorageIndex as Arc for Tauri State.
pub type StorageIndexState = Arc<StorageIndex>;

/// Type alias for AssetManager as Arc for Tauri State.
pub type AssetManagerState = Arc<AssetManager>;

/// Create a text drop.
#[tauri::command]
pub async fn create_text_drop(
    text: String,
    storage: State<'_, DropStorageState>,
) -> Result<Drop> {
    let storage = storage.lock().await;
    storage.create(DropContent::Text { text })
}

/// Create a URL drop.
#[tauri::command]
pub async fn create_url_drop(
    url: String,
    title: Option<String>,
    storage: State<'_, DropStorageState>,
) -> Result<Drop> {
    let storage = storage.lock().await;
    storage.create(DropContent::Url { url, title })
}

/// Create an image drop. Copies the file to assets if an AssetManager is available.
#[tauri::command]
pub async fn create_image_drop(
    path: String,
    ocr_text: Option<String>,
    storage: State<'_, DropStorageState>,
    asset_manager: State<'_, AssetManagerState>,
) -> Result<Drop> {
    let source = std::path::Path::new(&path);
    let asset_path = if source.exists() {
        asset_manager.copy_to_assets(source, "images")?
    } else {
        std::path::PathBuf::from(&path)
    };

    let storage = storage.lock().await;
    storage.create(DropContent::Image {
        path: asset_path,
        ocr_text,
    })
}

/// Create a file drop. Copies the file to assets.
#[tauri::command]
pub async fn create_file_drop(
    path: String,
    file_type: String,
    storage: State<'_, DropStorageState>,
    asset_manager: State<'_, AssetManagerState>,
) -> Result<Drop> {
    let source = std::path::Path::new(&path);
    let asset_path = if source.exists() {
        asset_manager.copy_to_assets(source, "files")?
    } else {
        std::path::PathBuf::from(&path)
    };

    let storage = storage.lock().await;
    storage.create(DropContent::File {
        path: asset_path,
        file_type,
    })
}

/// Create a voice drop. Copies the audio file to assets.
#[tauri::command]
pub async fn create_voice_drop(
    path: String,
    transcription: Option<String>,
    storage: State<'_, DropStorageState>,
    asset_manager: State<'_, AssetManagerState>,
) -> Result<Drop> {
    let source = std::path::Path::new(&path);
    let asset_path = if source.exists() {
        asset_manager.copy_to_assets(source, "voice")?
    } else {
        std::path::PathBuf::from(&path)
    };

    let storage = storage.lock().await;
    storage.create(DropContent::Voice {
        path: asset_path,
        transcription,
    })
}

/// Get a drop by ID.
#[tauri::command]
pub async fn get_drop(
    id: String,
    storage: State<'_, DropStorageState>,
) -> Result<Option<Drop>> {
    let id = Uuid::parse_str(&id)
        .map_err(|e| crate::error::AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let storage = storage.lock().await;
    storage.get(id)
}

/// List all drops.
#[tauri::command]
pub async fn list_drops(
    storage: State<'_, DropStorageState>,
) -> Result<Vec<Drop>> {
    let storage = storage.lock().await;
    storage.list()
}

/// Delete a drop by ID.
#[tauri::command]
pub async fn delete_drop(
    id: String,
    storage: State<'_, DropStorageState>,
) -> Result<()> {
    let id = Uuid::parse_str(&id)
        .map_err(|e| crate::error::AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let storage = storage.lock().await;
    storage.delete(id)
}

/// Update an existing drop.
#[tauri::command]
pub async fn update_drop(
    drop: Drop,
    storage: State<'_, DropStorageState>,
) -> Result<Drop> {
    let storage = storage.lock().await;
    storage.update(drop)
}

/// List drops filtered by status ("raw", "processed", or "archived").
#[tauri::command]
pub async fn list_drops_by_status(
    status: String,
    storage: State<'_, DropStorageState>,
) -> Result<Vec<Drop>> {
    let drop_status = match status.to_lowercase().as_str() {
        "raw" => DropStatus::Raw,
        "processed" => DropStatus::Processed,
        "archived" => DropStatus::Archived,
        _ => return Err(crate::error::AppError::Validation(format!("Invalid drop status: {}", status))),
    };
    let storage = storage.lock().await;
    storage.list_by_status(drop_status)
}

/// Search drops using full-text search.
#[tauri::command]
pub async fn search_drops(
    query: String,
    limit: Option<usize>,
    offset: Option<usize>,
    index: State<'_, StorageIndexState>,
) -> Result<PaginatedResult<DropSearchResult>> {
    index.search_drops(&query, limit.unwrap_or(50), offset.unwrap_or(0))
}

/// List drops with pagination and optional status filter.
#[tauri::command]
pub async fn list_drops_paginated(
    status: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    index: State<'_, StorageIndexState>,
) -> Result<PaginatedResult<DropSearchResult>> {
    let status_ref = status.as_deref();
    index.list_drops_paginated(status_ref, limit.unwrap_or(50), offset.unwrap_or(0))
}
