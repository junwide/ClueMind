// src-tauri/src/commands/drop_commands.rs
//! Tauri commands for Drop operations.
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use crate::storage::DropStorage;
use crate::models::{Drop, DropContent, DropStatus};
use crate::error::Result;
use uuid::Uuid;

/// Type alias for DropStorage wrapped in Arc<Mutex<>> for Tauri State.
pub type DropStorageState = Arc<Mutex<DropStorage>>;

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

/// Create an image drop.
#[tauri::command]
pub async fn create_image_drop(
    path: String,
    ocr_text: Option<String>,
    storage: State<'_, DropStorageState>,
) -> Result<Drop> {
    let storage = storage.lock().await;
    storage.create(DropContent::Image {
        path: path.into(),
        ocr_text,
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
