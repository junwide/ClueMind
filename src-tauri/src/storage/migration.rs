// src-tauri/src/storage/migration.rs
//! One-time migration from JSON index files to SQLite.
//! Reads all existing drops/, frameworks/, conversations/ JSON files
//! and populates the SQLite index.

use super::index::{StorageIndex, DropIndexParams, FrameworkIndexParams, ConversationIndexParams};
use crate::error::{AppError, Result};
use crate::models::{Drop, DropContent};
use std::path::Path;

/// Run migration from JSON files to SQLite index.
/// Only runs if the SQLite index is empty.
pub fn migrate_from_json(data_dir: &Path, index: &StorageIndex) -> Result<()> {
    if !index.is_empty()? {
        tracing::info!("SQLite index already populated, skipping migration");
        return Ok(());
    }

    tracing::info!("Starting JSON → SQLite migration from {:?}", data_dir);

    // Migrate drops
    migrate_drops(data_dir, index)?;

    // Migrate frameworks
    migrate_frameworks(data_dir, index)?;

    // Migrate conversations
    migrate_conversations(data_dir, index)?;

    tracing::info!("JSON → SQLite migration complete");
    Ok(())
}

fn migrate_drops(data_dir: &Path, index: &StorageIndex) -> Result<()> {
    let drops_dir = data_dir.join("drops");
    if !drops_dir.exists() {
        return Ok(());
    }

    let mut count = 0u32;
    for entry in std::fs::read_dir(&drops_dir)
        .map_err(|e| AppError::Io(format!("Failed to read drops dir: {}", e)))?
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();

        if path.extension().map(|e| e == "json").unwrap_or(false)
            && path.file_name().map(|n| n != "index.json").unwrap_or(true)
        {
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    match serde_json::from_str::<Drop>(&content) {
                        Ok(drop) => {
                            let (content_type, preview, searchable_text) = extract_drop_text(&drop);
                            if let Err(e) = index.index_drop(&DropIndexParams {
                                id: &drop.id.to_string(),
                                content_type,
                                preview: &preview,
                                searchable_text: &searchable_text,
                                status: serde_json::to_string(&drop.status).unwrap_or_else(|_| "\"raw\"".into()).trim_matches('"'),
                                source: serde_json::to_string(&drop.metadata.source).unwrap_or_else(|_| "\"manual\"".into()).trim_matches('"'),
                                tags: &serde_json::to_string(&drop.metadata.tags).unwrap_or_else(|_| "[]".into()),
                                related_framework_ids: &serde_json::to_string(&drop.metadata.related_framework_ids).unwrap_or_else(|_| "[]".into()),
                                created_at: &drop.created_at.to_rfc3339(),
                                updated_at: &drop.updated_at.to_rfc3339(),
                                remote_id: drop.remote_id.as_deref(),
                                synced_at: drop.synced_at.map(|t| t.to_rfc3339()).as_deref(),
                            }) {
                                tracing::warn!("Failed to index drop {}: {}", drop.id, e);
                            } else {
                                count += 1;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse drop {:?}: {}", path, e);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to read drop file {:?}: {}", path, e);
                }
            }
        }
    }

    tracing::info!("Migrated {} drops to SQLite", count);
    Ok(())
}

fn migrate_frameworks(data_dir: &Path, index: &StorageIndex) -> Result<()> {
    let frameworks_dir = data_dir.join("frameworks");
    if !frameworks_dir.exists() {
        return Ok(());
    }

    let mut count = 0u32;
    for entry in std::fs::read_dir(&frameworks_dir)
        .map_err(|e| AppError::Io(format!("Failed to read frameworks dir: {}", e)))?
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();

        if path.extension().map(|e| e == "json").unwrap_or(false) {
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(fw) => {
                            let id = fw["id"].as_str()
                                .or_else(|| path.file_stem().and_then(|s| s.to_str()))
                                .unwrap_or("")
                                .to_string();
                            let title = fw["title"].as_str().unwrap_or("").to_string();
                            let description = fw["description"].as_str().unwrap_or("").to_string();
                            let structure_type = fw["structureType"].as_str()
                                .or_else(|| fw["structure_type"].as_str())
                                .unwrap_or("custom");
                            let lifecycle = fw["lifecycle"].as_str().unwrap_or("draft");
                            let node_count = fw["nodes"].as_array().map(|a| a.len()).unwrap_or(0);
                            let edge_count = fw["edges"].as_array().map(|a| a.len()).unwrap_or(0);
                            let drop_count = fw["createdFromDrops"].as_array()
                                .or_else(|| fw["created_from_drops"].as_array())
                                .map(|a| a.len()).unwrap_or(0);
                            let created_at = fw["createdAt"].as_str()
                                .or_else(|| fw["created_at"].as_str())
                                .unwrap_or("");
                            let updated_at = fw["updatedAt"].as_str()
                                .or_else(|| fw["updated_at"].as_str())
                                .unwrap_or("");

                            if let Err(e) = index.index_framework(&FrameworkIndexParams {
                                id: &id, title: &title, description: &description,
                                structure_type, lifecycle,
                                node_count, edge_count, drop_count, created_at, updated_at,
                            }) {
                                tracing::warn!("Failed to index framework {}: {}", id, e);
                            } else {
                                count += 1;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse framework {:?}: {}", path, e);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to read framework file {:?}: {}", path, e);
                }
            }
        }
    }

    tracing::info!("Migrated {} frameworks to SQLite", count);
    Ok(())
}

fn migrate_conversations(data_dir: &Path, index: &StorageIndex) -> Result<()> {
    let convs_dir = data_dir.join("conversations");
    if !convs_dir.exists() {
        return Ok(());
    }

    let mut count = 0u32;
    for entry in std::fs::read_dir(&convs_dir)
        .map_err(|e| AppError::Io(format!("Failed to read conversations dir: {}", e)))?
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();

        if path.extension().map(|e| e == "json").unwrap_or(false)
            && path.file_name().map(|n| n != "index.json").unwrap_or(true)
        {
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(conv) => {
                            let id = conv["id"].as_str()
                                .or_else(|| path.file_stem().and_then(|s| s.to_str()))
                                .unwrap_or("")
                                .to_string();
                            let framework_id = conv["frameworkId"]
                                .as_str()
                                .or_else(|| conv["framework_id"].as_str());
                            let summary = conv["summary"].as_str().unwrap_or("").to_string();
                            let message_count = conv["messages"].as_array().map(|a| a.len()).unwrap_or(0);
                            let provider = conv["provider"].as_str().unwrap_or("").to_string();
                            let model = conv["model"].as_str().unwrap_or("").to_string();
                            let created_at = conv["createdAt"].as_str()
                                .or_else(|| conv["created_at"].as_str())
                                .unwrap_or("");
                            let updated_at = conv["updatedAt"].as_str()
                                .or_else(|| conv["updated_at"].as_str())
                                .unwrap_or("");

                            if let Err(e) = index.index_conversation(&ConversationIndexParams {
                                id: &id, framework_id, summary: &summary, message_count,
                                provider: &provider, model: &model, created_at, updated_at,
                            }) {
                                tracing::warn!("Failed to index conversation {}: {}", id, e);
                            } else {
                                count += 1;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse conversation {:?}: {}", path, e);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to read conversation file {:?}: {}", path, e);
                }
            }
        }
    }

    tracing::info!("Migrated {} conversations to SQLite", count);
    Ok(())
}

/// Extract text content from a Drop for indexing and preview.
fn extract_drop_text(drop: &Drop) -> (/*content_type*/ &'static str, /*preview*/ String, /*searchable_text*/ String) {
    match &drop.content {
        DropContent::Text { text } => {
            let preview: String = text.chars().take(100).collect();
            ("text", preview.clone(), text.clone())
        }
        DropContent::Url { url, title } => {
            let searchable = match title {
                Some(t) => format!("{} {}", url, t),
                None => url.clone(),
            };
            ("url", url.clone(), searchable)
        }
        DropContent::Image { path, ocr_text } => {
            let searchable = match ocr_text {
                Some(ocr) => format!("{} {}", path.display(), ocr),
                None => path.display().to_string(),
            };
            ("image", path.display().to_string(), searchable)
        }
        DropContent::File { path, file_type } => {
            ("file", path.display().to_string(), format!("{} {}", path.display(), file_type))
        }
        DropContent::Voice { path, transcription } => {
            let searchable = match transcription {
                Some(t) => format!("{} {}", path.display(), t),
                None => path.display().to_string(),
            };
            ("voice", path.display().to_string(), searchable)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_migration_skips_when_populated() {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("test.db");
        let index = StorageIndex::new(&db_path).unwrap();

        // Add one drop to make it non-empty
        index.index_drop(&DropIndexParams {
            id: "existing", content_type: "text", preview: "preview", searchable_text: "text",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        // Migration should skip
        migrate_from_json(dir.path(), &index).unwrap();
    }

    #[test]
    fn test_extract_drop_text_text() {
        use crate::models::{DropMetadata, DropSource, DropStatus};
        use chrono::Utc;

        let drop = Drop {
            id: uuid::Uuid::new_v4(),
            content: DropContent::Text { text: "Hello world of AI".to_string() },
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
            remote_id: None,
            synced_at: None,
        };

        let (ct, preview, searchable) = extract_drop_text(&drop);
        assert_eq!(ct, "text");
        assert_eq!(preview, "Hello world of AI");
        assert!(searchable.contains("AI"));
    }

    #[test]
    fn test_extract_drop_text_url() {
        use crate::models::{DropMetadata, DropSource, DropStatus};
        use chrono::Utc;

        let drop = Drop {
            id: uuid::Uuid::new_v4(),
            content: DropContent::Url {
                url: "https://example.com".to_string(),
                title: Some("Example Site".to_string()),
            },
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
            remote_id: None,
            synced_at: None,
        };

        let (ct, preview, searchable) = extract_drop_text(&drop);
        assert_eq!(ct, "url");
        assert_eq!(preview, "https://example.com");
        assert!(searchable.contains("Example Site"));
    }
}
