use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Drop {
    pub id: Uuid,
    pub content: DropContent,
    pub metadata: DropMetadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: DropStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DropContent {
    Text { text: String },
    Url { url: String, title: Option<String> },
    Image { path: PathBuf, ocr_text: Option<String> },
    File { path: PathBuf, file_type: String },
    Voice { path: PathBuf, transcription: Option<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropMetadata {
    pub source: DropSource,
    pub tags: Vec<String>,
    pub related_framework_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DropSource {
    ShareSheet,
    Hotkey,
    Browser,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DropStatus {
    Raw,
    Processed,
    Archived,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_drop_creation() {
        let drop = Drop {
            id: Uuid::new_v4(),
            content: DropContent::Text { text: "test".to_string() },
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
        };

        assert!(!drop.id.to_string().is_empty());
        assert_eq!(drop.status, DropStatus::Raw);
    }

    #[test]
    fn test_drop_content_serialization() {
        let content = DropContent::Url {
            url: "https://example.com".to_string(),
            title: Some("Example".to_string()),
        };
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("url"));
        assert!(json.contains("Example"));
    }

    #[test]
    fn test_drop_source_equality() {
        assert_eq!(DropSource::Manual, DropSource::Manual);
        assert_ne!(DropSource::Manual, DropSource::Browser);
    }

    #[test]
    fn test_drop_status_equality() {
        assert_eq!(DropStatus::Raw, DropStatus::Raw);
        assert_ne!(DropStatus::Raw, DropStatus::Processed);
    }
}
