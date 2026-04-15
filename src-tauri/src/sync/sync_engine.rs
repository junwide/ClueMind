// src-tauri/src/sync/sync_engine.rs
//! Sync engine: pull drops from server, push local drops, resolve conflicts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::error::{AppError, Result};
use crate::models::{Drop, DropContent, DropMetadata, DropSource, DropStatus};
use crate::storage::DropStorage;
use crate::storage::StorageIndex;
use crate::sync::sync_client::{SyncClient, ServerDrop, ServerDropContent, ServerDropUpdate};

/// Sync status tracked across sessions.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub last_sync_at: Option<DateTime<Utc>>,
    pub is_syncing: bool,
    pub last_error: Option<String>,
    pub pushed_count: usize,
    pub pulled_count: usize,
    pub conflict_count: usize,
}

/// Metadata file for tracking sync state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncMeta {
    last_sync_at: Option<DateTime<Utc>>,
    pushed_count: usize,
    pulled_count: usize,
    conflict_count: usize,
}

/// The sync engine coordinates pull and push with the server.
pub struct SyncEngine {
    client: SyncClient,
    drop_storage: Arc<Mutex<DropStorage>>,
    storage_index: Arc<StorageIndex>,
    data_dir: PathBuf,
}

impl SyncEngine {
    pub fn new(
        base_url: &str,
        token: &str,
        drop_storage: Arc<Mutex<DropStorage>>,
        storage_index: Arc<StorageIndex>,
        data_dir: PathBuf,
    ) -> Self {
        Self {
            client: SyncClient::new(base_url, token),
            drop_storage,
            storage_index,
            data_dir,
        }
    }

    /// Get the data directory path.
    pub fn data_dir(&self) -> &std::path::Path {
        &self.data_dir
    }

    /// Execute a full sync cycle (pull then push).
    pub async fn sync(&self) -> Result<SyncStatus> {
        let mut status = SyncStatus { is_syncing: true, ..Default::default() };

        // Load last sync time
        let last_sync_at = self.load_sync_meta().last_sync_at;

        // Phase 1: Pull
        match self.pull(last_sync_at.as_ref(), &mut status).await {
            Ok(()) => {}
            Err(e) => {
                status.last_error = Some(format!("Pull failed: {}", e));
                status.is_syncing = false;
                self.save_sync_meta(&status)?;
                return Ok(status);
            }
        }

        // Phase 2: Push
        match self.push(&mut status).await {
            Ok(()) => {}
            Err(e) => {
                status.last_error = Some(format!("Push failed: {}", e));
            }
        }

        status.is_syncing = false;
        status.last_sync_at = Some(Utc::now());
        self.save_sync_meta(&status)?;

        Ok(status)
    }

    /// Pull drops from server.
    async fn pull(
        &self,
        since: Option<&DateTime<Utc>>,
        status: &mut SyncStatus,
    ) -> Result<()> {
        let mut offset = 0;
        let limit = 50;

        loop {
            let response = self.client.list_drops(since, limit, offset).await?;
            let count = response.items.len();

            for server_drop in &response.items {
                match self.process_remote_drop(server_drop, status).await {
                    Ok(true) => status.pulled_count += 1,
                    Ok(false) => {} // No change needed
                    Err(e) => {
                        tracing::warn!("Failed to process remote drop {}: {}", server_drop.id, e);
                    }
                }
            }

            if count < limit || offset + count >= response.total {
                break;
            }
            offset += count;
        }

        Ok(())
    }

    /// Process a single remote drop: create or update locally.
    /// Returns true if a change was made, false if no action needed.
    async fn process_remote_drop(
        &self,
        remote: &ServerDrop,
        status: &mut SyncStatus,
    ) -> Result<bool> {
        // Check if we already have this drop by remote_id
        let existing = self.storage_index.find_by_remote_id(&remote.id)?;

        match existing {
            None => {
                // New remote drop — create locally
                let local_drop = self.convert_remote_to_local(remote)?;
                let storage = self.drop_storage.lock().await;
                storage.create_from_sync(local_drop)?;
                tracing::info!("Pulled new drop from server: remote_id={}", remote.id);
                Ok(true)
            }
            Some(local_summary) => {
                // Existing drop — compare timestamps
                let local_id = uuid::Uuid::parse_str(&local_summary.id)
                    .map_err(|e| AppError::Storage(format!("Invalid UUID: {}", e)))?;

                let storage = self.drop_storage.lock().await;
                if let Some(mut local) = storage.get(local_id)? {
                    let remote_updated = DateTime::parse_from_rfc3339(&remote.updated_at)
                        .map_err(|e| AppError::Api(format!("Invalid remote timestamp: {}", e)))?
                        .with_timezone(&Utc);

                    if remote_updated > local.updated_at {
                        // Remote is newer — update local (including content)
                        self.update_local_from_remote(&mut local, remote);
                        storage.update_from_sync(local)?;
                        tracing::info!("Updated local drop from server: remote_id={}", remote.id);
                        return Ok(true);
                    } else if local.updated_at > remote_updated {
                        // Local is newer — conflict, will be handled in push phase
                        tracing::debug!("Conflict: local is newer for remote_id={}", remote.id);
                        status.conflict_count += 1;
                    }
                    // Equal timestamps — no action needed
                    Ok(false)
                } else {
                    Ok(false)
                }
            }
        }
    }

    /// Push local drops to server.
    async fn push(&self, status: &mut SyncStatus) -> Result<()> {
        let unsynced = self.storage_index.find_unsynced_drops()?;
        let storage = self.drop_storage.lock().await;

        for summary in &unsynced {
            let local_id = match uuid::Uuid::parse_str(&summary.id) {
                Ok(id) => id,
                Err(_) => continue,
            };

            let local_drop = match storage.get(local_id) {
                Ok(Some(d)) => d,
                _ => continue,
            };

            let result = if local_drop.remote_id.is_some() {
                // Has remote_id — update on server
                self.push_update(&storage, &local_drop).await
            } else {
                // No remote_id — create on server
                self.push_create(&storage, &local_drop).await
            };

            match result {
                Ok(()) => status.pushed_count += 1,
                Err(e) => {
                    tracing::warn!("Failed to push drop {}: {}", local_drop.id, e);
                    status.last_error = Some(format!("Push error: {}", e));
                }
            }
        }

        Ok(())
    }

    /// Push a new local drop to the server (create).
    async fn push_create(
        &self,
        storage: &DropStorage,
        drop: &Drop,
    ) -> Result<()> {
        let server_drop = match &drop.content {
            DropContent::Text { text } => {
                self.client.create_text_drop(text).await?
            }
            DropContent::Url { url, title } => {
                self.client.create_url_drop(url, title.as_deref()).await?
            }
            DropContent::Image { path, ocr_text } => {
                self.client.create_image_drop(path, ocr_text.as_deref()).await?
            }
            DropContent::File { path, file_type } => {
                self.client.create_file_drop(path, file_type).await?
            }
            DropContent::Voice { path, transcription } => {
                self.client.create_voice_drop(path, transcription.as_deref()).await?
            }
        };

        // Save the remote_id back to local drop
        let local_id = drop.id;
        if let Some(mut local) = storage.get(local_id)? {
            local.remote_id = Some(server_drop.id);
            local.synced_at = Some(Utc::now());
            storage.update_from_sync(local)?;
        }

        Ok(())
    }

    /// Push an update to an existing server drop.
    async fn push_update(
        &self,
        storage: &DropStorage,
        drop: &Drop,
    ) -> Result<()> {
        let remote_id = drop.remote_id.as_deref()
            .ok_or_else(|| AppError::Storage("Drop has no remote_id".to_string()))?;

        let content_json = serde_json::to_value(&drop.content)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        let update = ServerDropUpdate {
            content: Some(content_json),
            status: Some(serde_json::to_string(&drop.status)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()),
            tags: Some(drop.metadata.tags.clone()),
        };

        self.client.update_drop(remote_id, &update).await?;

        // Update synced_at
        if let Some(mut local) = storage.get(drop.id)? {
            local.synced_at = Some(Utc::now());
            storage.update_from_sync(local)?;
        }

        Ok(())
    }

    // --- Conversion helpers ---

    /// Convert a server drop to a local Drop.
    fn convert_remote_to_local(&self, remote: &ServerDrop) -> Result<Drop> {
        let content = Self::convert_remote_content(&remote.content);

        let source = match remote.metadata.source.as_str() {
            "sharesheet" => DropSource::ShareSheet,
            "hotkey" => DropSource::Hotkey,
            "browser" => DropSource::Browser,
            _ => DropSource::Manual,
        };

        let related_ids = remote.metadata.related_framework_ids.iter()
            .filter_map(|id| uuid::Uuid::parse_str(id).ok())
            .collect();

        let local_status = match remote.status.as_str() {
            "processed" => DropStatus::Processed,
            "archived" => DropStatus::Archived,
            _ => DropStatus::Raw,
        };

        Ok(Drop {
            id: uuid::Uuid::new_v4(),
            content,
            metadata: DropMetadata {
                source,
                tags: remote.metadata.tags.clone(),
                related_framework_ids: related_ids,
            },
            created_at: DateTime::parse_from_rfc3339(&remote.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&remote.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            status: local_status,
            remote_id: Some(remote.id.clone()),
            synced_at: Some(Utc::now()),
        })
    }

    /// Convert server content to local content.
    fn convert_remote_content(remote: &ServerDropContent) -> DropContent {
        match remote {
            ServerDropContent::Text { text } => DropContent::Text { text: text.clone() },
            ServerDropContent::Url { url, title } => DropContent::Url {
                url: url.clone(),
                title: title.clone(),
            },
            ServerDropContent::Image { path, ocr_text } => DropContent::Image {
                path: PathBuf::from(path),
                ocr_text: ocr_text.clone(),
            },
            ServerDropContent::File { path, file_type } => DropContent::File {
                path: PathBuf::from(path),
                file_type: file_type.clone().unwrap_or_default(),
            },
            ServerDropContent::Voice { path, transcription } => DropContent::Voice {
                path: PathBuf::from(path),
                transcription: transcription.clone(),
            },
        }
    }

    /// Update local drop fields from remote data (including content).
    fn update_local_from_remote(&self, local: &mut Drop, remote: &ServerDrop) {
        // Update content from remote
        local.content = Self::convert_remote_content(&remote.content);

        local.status = match remote.status.as_str() {
            "processed" => DropStatus::Processed,
            "archived" => DropStatus::Archived,
            _ => DropStatus::Raw,
        };
        local.metadata.tags = remote.metadata.tags.clone();

        if let Ok(dt) = DateTime::parse_from_rfc3339(&remote.updated_at) {
            local.updated_at = dt.with_timezone(&Utc);
        }
        local.synced_at = Some(Utc::now());
    }

    // --- Sync meta persistence ---

    fn sync_meta_path(&self) -> PathBuf {
        self.data_dir.join("sync_meta.json")
    }

    fn load_sync_meta(&self) -> SyncMeta {
        let path = self.sync_meta_path();
        if !path.exists() {
            return SyncMeta::default();
        }
        match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => SyncMeta::default(),
        }
    }

    fn save_sync_meta(&self, status: &SyncStatus) -> Result<()> {
        let meta = SyncMeta {
            last_sync_at: status.last_sync_at,
            pushed_count: status.pushed_count,
            pulled_count: status.pulled_count,
            conflict_count: status.conflict_count,
        };
        let content = serde_json::to_string_pretty(&meta)
            .map_err(|e| AppError::Serialization(e.to_string()))?;
        std::fs::write(self.sync_meta_path(), content)
            .map_err(|e| AppError::Io(format!("Failed to write sync meta: {}", e)))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_status_default() {
        let status = SyncStatus::default();
        assert!(status.last_sync_at.is_none());
        assert!(!status.is_syncing);
        assert!(status.last_error.is_none());
        assert_eq!(status.pushed_count, 0);
        assert_eq!(status.pulled_count, 0);
        assert_eq!(status.conflict_count, 0);
    }

    #[test]
    fn test_sync_status_serialization() {
        let status = SyncStatus {
            last_sync_at: Some(Utc::now()),
            is_syncing: false,
            last_error: None,
            pushed_count: 3,
            pulled_count: 5,
            conflict_count: 1,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("pushedCount"));
        assert!(json.contains("pulledCount"));
        assert!(json.contains("conflictCount"));

        let parsed: SyncStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.pushed_count, 3);
        assert_eq!(parsed.pulled_count, 5);
        assert_eq!(parsed.conflict_count, 1);
    }

    #[test]
    fn test_sync_meta_default() {
        let meta = SyncMeta::default();
        assert!(meta.last_sync_at.is_none());
    }

    #[test]
    fn test_convert_remote_content() {
        let text_content = ServerDropContent::Text { text: "hello".to_string() };
        let local = SyncEngine::convert_remote_content(&text_content);
        assert!(matches!(local, DropContent::Text { ref text } if text == "hello"));

        let url_content = ServerDropContent::Url {
            url: "https://example.com".to_string(),
            title: Some("Example".to_string()),
        };
        let local = SyncEngine::convert_remote_content(&url_content);
        if let DropContent::Url { url, title } = &local {
            assert_eq!(url, "https://example.com");
            assert_eq!(title.as_deref(), Some("Example"));
        } else {
            panic!("Expected Url variant");
        }
    }

    #[test]
    fn test_convert_remote_source_mapping() {
        assert!(matches!(
            match "browser" {
                "sharesheet" => DropSource::ShareSheet,
                "hotkey" => DropSource::Hotkey,
                "browser" => DropSource::Browser,
                _ => DropSource::Manual,
            },
            DropSource::Browser
        ));
    }

    #[test]
    fn test_sync_meta_persists_counts() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("index.db");
        let engine = SyncEngine::new(
            "http://localhost:3817",
            "token",
            Arc::new(Mutex::new(DropStorage::new(dir.path().to_path_buf()))),
            Arc::new(StorageIndex::new(&db_path).unwrap()),
            dir.path().to_path_buf(),
        );

        let status = SyncStatus {
            last_sync_at: Some(Utc::now()),
            is_syncing: false,
            last_error: None,
            pushed_count: 7,
            pulled_count: 3,
            conflict_count: 2,
        };

        engine.save_sync_meta(&status).unwrap();

        let meta = engine.load_sync_meta();
        assert_eq!(meta.pushed_count, 7);
        assert_eq!(meta.pulled_count, 3);
        assert_eq!(meta.conflict_count, 2);
    }
}
