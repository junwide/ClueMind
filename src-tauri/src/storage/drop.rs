//! Drop storage for user inputs (text, URLs, images).
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::fs;
use std::path::PathBuf;
use crate::error::{AppError, Result};
use crate::models::{Drop, DropContent, DropMetadata, DropSource, DropStatus};
use tracing::{debug, warn};

/// Maximum length for preview text
const PREVIEW_LENGTH: usize = 100;
/// Index file name
const INDEX_FILE: &str = "index.json";

/// Index for listing drops.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct DropIndex {
    drops: Vec<DropSummary>,
    last_updated: DateTime<Utc>,
}

/// Summary of a drop for listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropSummary {
    pub id: Uuid,
    pub content_type: String,
    pub preview: String,
    pub created_at: DateTime<Utc>,
}

/// Storage for drops.
pub struct DropStorage {
    base_path: PathBuf,
}

impl DropStorage {
    /// Create a new drop storage.
    pub fn new(base_path: PathBuf) -> Self {
        Self {
            base_path: base_path.join("drops"),
        }
    }

    /// Create a new drop.
    pub fn create(&self, content: DropContent) -> Result<Drop> {
        fs::create_dir_all(&self.base_path)
            .map_err(|e| AppError::Io(format!("Failed to create drops directory: {}", e)))?;

        let now = Utc::now();
        let drop = Drop {
            id: Uuid::new_v4(),
            content,
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: now,
            updated_at: now,
            status: DropStatus::Raw,
        };

        let file_path = self.base_path.join(format!("{}.json", drop.id));
        let json_content = serde_json::to_string_pretty(&drop)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        fs::write(&file_path, json_content)
            .map_err(|e| AppError::Io(format!("Failed to write drop file: {}", e)))?;

        debug!("Created drop with id: {}", drop.id);
        self.update_index()?;
        Ok(drop)
    }

    /// Get a drop by ID.
    pub fn get(&self, id: Uuid) -> Result<Option<Drop>> {
        let file_path = self.base_path.join(format!("{}.json", id));

        if !file_path.exists() {
            debug!("Drop not found: {}", id);
            return Ok(None);
        }

        let content = fs::read_to_string(&file_path)
            .map_err(|e| AppError::Io(format!("Failed to read drop file: {}", e)))?;

        let drop: Drop = serde_json::from_str(&content)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        debug!("Retrieved drop: {}", id);
        Ok(Some(drop))
    }

    /// List all drops.
    pub fn list(&self) -> Result<Vec<Drop>> {
        let index = self.load_index()?;
        let drops: Vec<Drop> = index
            .drops
            .into_iter()
            .filter_map(|s| self.get(s.id).ok().flatten())
            .collect();

        Ok(drops)
    }

    /// List drops filtered by status.
    pub fn list_by_status(&self, status: DropStatus) -> Result<Vec<Drop>> {
        let all = self.list()?;
        Ok(all.into_iter().filter(|d| d.status == status).collect())
    }

    /// Delete a drop by ID.
    pub fn delete(&self, id: Uuid) -> Result<()> {
        let file_path = self.base_path.join(format!("{}.json", id));

        let existed = file_path.exists();

        if existed {
            fs::remove_file(&file_path)
                .map_err(|e| AppError::Io(format!("Failed to delete drop file: {}", e)))?;
            debug!("Deleted drop file: {}", id);
        } else {
            warn!("Attempted to delete non-existent drop: {}", id);
        }

        // Update index regardless of whether file existed
        // This ensures the index is consistent
        self.update_index()?;
        Ok(())
    }

    /// Update an existing drop.
    pub fn update(&self, drop: Drop) -> Result<Drop> {
        let file_path = self.base_path.join(format!("{}.json", drop.id));

        if !file_path.exists() {
            return Err(AppError::Storage(format!("Drop not found: {}", drop.id)));
        }

        let updated = Drop {
            updated_at: Utc::now(),
            ..drop
        };

        let json_content = serde_json::to_string_pretty(&updated)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        fs::write(&file_path, json_content)
            .map_err(|e| AppError::Io(format!("Failed to write drop file: {}", e)))?;

        debug!("Updated drop: {}", updated.id);
        self.update_index()?;
        Ok(updated)
    }

    fn load_index(&self) -> Result<DropIndex> {
        let index_path = self.base_path.join(INDEX_FILE);

        if !index_path.exists() {
            debug!("Index file not found, returning default index");
            return Ok(DropIndex::default());
        }

        let content = fs::read_to_string(&index_path)
            .map_err(|e| AppError::Io(format!("Failed to read index file: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| AppError::Serialization(e.to_string()))
    }

    fn update_index(&self) -> Result<()> {
        // Ensure directory exists before updating index
        if !self.base_path.exists() {
            fs::create_dir_all(&self.base_path)
                .map_err(|e| AppError::Io(format!("Failed to create drops directory for index: {}", e)))?;
        }

        let mut drops = Vec::new();

        for entry in fs::read_dir(&self.base_path)
            .map_err(|e| AppError::Io(format!("Failed to read drops directory: {}", e)))?
        {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let path = entry.path();

            // Skip non-JSON files and the index file itself
            if path.extension().map(|e| e == "json").unwrap_or(false)
                && path.file_name().map(|n| n != INDEX_FILE).unwrap_or(true)
            {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match serde_json::from_str::<Drop>(&content) {
                            Ok(drop) => {
                                let preview = match &drop.content {
                                    DropContent::Text { text } => {
                                        text.chars().take(PREVIEW_LENGTH).collect()
                                    }
                                    DropContent::Url { url, .. } => url.clone(),
                                    DropContent::Image { path, .. } => {
                                        path.display().to_string()
                                    }
                                    DropContent::File { path, .. } => {
                                        path.display().to_string()
                                    }
                                    DropContent::Voice { path, .. } => {
                                        path.display().to_string()
                                    }
                                };
                                let content_type = match &drop.content {
                                    DropContent::Text { .. } => "text",
                                    DropContent::Url { .. } => "url",
                                    DropContent::Image { .. } => "image",
                                    DropContent::File { .. } => "file",
                                    DropContent::Voice { .. } => "voice",
                                };
                                drops.push(DropSummary {
                                    id: drop.id,
                                    content_type: content_type.to_string(),
                                    preview,
                                    created_at: drop.created_at,
                                });
                            }
                            Err(e) => {
                                warn!("Failed to parse drop file {:?}: {}", path, e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read drop file {:?}: {}", path, e);
                    }
                }
            }
        }

        // Sort by created_at descending (newest first)
        drops.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        let index = DropIndex {
            drops,
            last_updated: Utc::now(),
        };

        let index_path = self.base_path.join(INDEX_FILE);
        let content = serde_json::to_string_pretty(&index)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        fs::write(&index_path, content)
            .map_err(|e| AppError::Io(format!("Failed to write index file: {}", e)))?;

        debug!("Updated drop index");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::Text {
            text: "Hello world".to_string(),
        }).unwrap();

        assert!(!drop.id.to_string().is_empty());
        assert!(matches!(drop.content, DropContent::Text { .. }));
    }

    #[test]
    fn test_get_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let created = storage.create(DropContent::Url {
            url: "https://example.com".to_string(),
            title: Some("Example".to_string()),
        }).unwrap();

        let loaded = storage.get(created.id).unwrap().unwrap();
        assert_eq!(loaded.id, created.id);
    }

    #[test]
    fn test_list_drops() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        storage.create(DropContent::Text { text: "One".to_string() }).unwrap();
        storage.create(DropContent::Text { text: "Two".to_string() }).unwrap();

        let list = storage.list().unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn test_delete_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::Text { text: "Delete me".to_string() }).unwrap();
        storage.delete(drop.id).unwrap();

        let loaded = storage.get(drop.id).unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn test_get_missing_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let result = storage.get(Uuid::new_v4()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_update_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let created = storage.create(DropContent::Text {
            text: "original".to_string(),
        }).unwrap();

        let mut updated = created.clone();
        updated.content = DropContent::Text {
            text: "updated".to_string(),
        };
        updated.status = DropStatus::Processed;

        let result = storage.update(updated).unwrap();
        assert_eq!(result.status, DropStatus::Processed);

        // Verify persisted
        let loaded = storage.get(result.id).unwrap().unwrap();
        if let DropContent::Text { text } = &loaded.content {
            assert_eq!(text, "updated");
        } else {
            panic!("Expected Text content");
        }
        assert_eq!(loaded.status, DropStatus::Processed);
    }

    #[test]
    fn test_update_nonexistent_drop_errors() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = Drop {
            id: Uuid::new_v4(),
            content: DropContent::Text { text: "ghost".to_string() },
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
        };

        let result = storage.update(drop);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_nonexistent_drop_ok() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        // Deleting a non-existent drop should succeed (idempotent)
        let result = storage.delete(Uuid::new_v4());
        assert!(result.is_ok());
    }

    #[test]
    fn test_list_by_status() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let d1 = storage.create(DropContent::Text { text: "raw1".to_string() }).unwrap();
        let _d2 = storage.create(DropContent::Text { text: "raw2".to_string() }).unwrap();

        // Process one drop
        let mut processed = d1.clone();
        processed.status = DropStatus::Processed;
        storage.update(processed).unwrap();

        let raw = storage.list_by_status(DropStatus::Raw).unwrap();
        let processed_list = storage.list_by_status(DropStatus::Processed).unwrap();
        let archived = storage.list_by_status(DropStatus::Archived).unwrap();

        assert_eq!(raw.len(), 1);
        assert_eq!(processed_list.len(), 1);
        assert_eq!(archived.len(), 0);
    }

    #[test]
    fn test_create_url_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::Url {
            url: "https://example.com".to_string(),
            title: Some("Example".to_string()),
        }).unwrap();

        let loaded = storage.get(drop.id).unwrap().unwrap();
        if let DropContent::Url { url, title } = &loaded.content {
            assert_eq!(url, "https://example.com");
            assert_eq!(title.as_deref(), Some("Example"));
        } else {
            panic!("Expected Url content");
        }
    }

    #[test]
    fn test_create_image_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::Image {
            path: PathBuf::from("/tmp/screenshot.png"),
            ocr_text: Some("OCR text".to_string()),
        }).unwrap();

        let loaded = storage.get(drop.id).unwrap().unwrap();
        if let DropContent::Image { path, ocr_text } = &loaded.content {
            assert_eq!(path, &PathBuf::from("/tmp/screenshot.png"));
            assert_eq!(ocr_text.as_deref(), Some("OCR text"));
        } else {
            panic!("Expected Image content");
        }
    }

    #[test]
    fn test_create_file_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::File {
            path: PathBuf::from("/tmp/document.pdf"),
            file_type: "pdf".to_string(),
        }).unwrap();

        let loaded = storage.get(drop.id).unwrap().unwrap();
        if let DropContent::File { path, file_type } = &loaded.content {
            assert_eq!(path, &PathBuf::from("/tmp/document.pdf"));
            assert_eq!(file_type, "pdf");
        } else {
            panic!("Expected File content");
        }
    }

    #[test]
    fn test_create_voice_drop() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let drop = storage.create(DropContent::Voice {
            path: PathBuf::from("/tmp/recording.wav"),
            transcription: Some("hello world".to_string()),
        }).unwrap();

        let loaded = storage.get(drop.id).unwrap().unwrap();
        if let DropContent::Voice { path, transcription } = &loaded.content {
            assert_eq!(path, &PathBuf::from("/tmp/recording.wav"));
            assert_eq!(transcription.as_deref(), Some("hello world"));
        } else {
            panic!("Expected Voice content");
        }
    }

    #[test]
    fn test_list_drops_sorted_by_created_at_desc() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let first = storage.create(DropContent::Text { text: "first".to_string() }).unwrap();
        let second = storage.create(DropContent::Text { text: "second".to_string() }).unwrap();

        let list = storage.list().unwrap();
        assert_eq!(list.len(), 2);
        // Newest first
        assert_eq!(list[0].id, second.id);
        assert_eq!(list[1].id, first.id);
    }

    #[test]
    fn test_update_preserves_and_updates_timestamp() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        let created = storage.create(DropContent::Text { text: "original".to_string() }).unwrap();
        let original_updated_at = created.updated_at;

        // Small delay to ensure updated_at differs
        std::thread::sleep(std::time::Duration::from_millis(10));

        let result = storage.update(created.clone()).unwrap();
        assert!(result.updated_at >= original_updated_at);
        assert_eq!(result.created_at, created.created_at);
    }
}
