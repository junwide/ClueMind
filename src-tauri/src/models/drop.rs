use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Drop {
    pub id: Uuid,
    pub content: DropContent,
    pub metadata: DropMetadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: DropStatus,
    #[serde(default)]
    pub remote_id: Option<String>,
    #[serde(default)]
    pub synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DropContent {
    Text { text: String },
    Url { url: String, title: Option<String> },
    Image { path: PathBuf, ocr_text: Option<String> },
    File { path: PathBuf, file_type: String },
    Voice { path: PathBuf, transcription: Option<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropMetadata {
    pub source: DropSource,
    pub tags: Vec<String>,
    pub related_framework_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DropSource {
    ShareSheet,
    Hotkey,
    Browser,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
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
            remote_id: None,
            synced_at: None,
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

    #[test]
    fn test_drop_full_serde_roundtrip() {
        let drop = Drop {
            id: Uuid::new_v4(),
            content: DropContent::Text {
                text: "hello world".to_string(),
            },
            metadata: DropMetadata {
                source: DropSource::Hotkey,
                tags: vec!["rust".to_string(), "test".to_string()],
                related_framework_ids: vec![Uuid::new_v4()],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
            remote_id: None,
            synced_at: None,
        };

        let json = serde_json::to_string(&drop).unwrap();
        let parsed: Drop = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, drop.id);
        assert_eq!(parsed.status, drop.status);
        assert_eq!(parsed.metadata.source, drop.metadata.source);
        assert_eq!(parsed.metadata.tags, drop.metadata.tags);
        assert_eq!(
            parsed.metadata.related_framework_ids,
            drop.metadata.related_framework_ids
        );
    }

    #[test]
    fn test_drop_content_text_serialization() {
        let content = DropContent::Text {
            text: "some text".to_string(),
        };
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("some text"));

        let parsed: DropContent = serde_json::from_str(&json).unwrap();
        assert!(matches!(parsed, DropContent::Text { text } if text == "some text"));
    }

    #[test]
    fn test_drop_content_url_roundtrip() {
        let content = DropContent::Url {
            url: "https://example.com".to_string(),
            title: Some("Example Site".to_string()),
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::Url { url, title } = parsed {
            assert_eq!(url, "https://example.com");
            assert_eq!(title.unwrap(), "Example Site");
        } else {
            panic!("Expected Url variant");
        }
    }

    #[test]
    fn test_drop_content_url_no_title() {
        let content = DropContent::Url {
            url: "https://example.com".to_string(),
            title: None,
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::Url { url, title } = parsed {
            assert_eq!(url, "https://example.com");
            assert!(title.is_none());
        } else {
            panic!("Expected Url variant");
        }
    }

    #[test]
    fn test_drop_content_image_roundtrip() {
        let content = DropContent::Image {
            path: PathBuf::from("/tmp/image.png"),
            ocr_text: Some("extracted text".to_string()),
        };
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("\"type\":\"image\""));

        let parsed: DropContent = serde_json::from_str(&json).unwrap();
        if let DropContent::Image { path, ocr_text } = parsed {
            assert_eq!(path, PathBuf::from("/tmp/image.png"));
            assert_eq!(ocr_text.unwrap(), "extracted text");
        } else {
            panic!("Expected Image variant");
        }
    }

    #[test]
    fn test_drop_content_file_roundtrip() {
        let content = DropContent::File {
            path: PathBuf::from("/tmp/doc.pdf"),
            file_type: "pdf".to_string(),
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::File { path, file_type } = parsed {
            assert_eq!(path, PathBuf::from("/tmp/doc.pdf"));
            assert_eq!(file_type, "pdf");
        } else {
            panic!("Expected File variant");
        }
    }

    #[test]
    fn test_drop_content_voice_roundtrip() {
        let content = DropContent::Voice {
            path: PathBuf::from("/tmp/audio.wav"),
            transcription: Some("hello".to_string()),
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::Voice { path, transcription } = parsed {
            assert_eq!(path, PathBuf::from("/tmp/audio.wav"));
            assert_eq!(transcription.unwrap(), "hello");
        } else {
            panic!("Expected Voice variant");
        }
    }

    #[test]
    fn test_drop_content_voice_no_transcription() {
        let content = DropContent::Voice {
            path: PathBuf::from("/tmp/audio.wav"),
            transcription: None,
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::Voice { transcription, .. } = parsed {
            assert!(transcription.is_none());
        } else {
            panic!("Expected Voice variant");
        }
    }

    #[test]
    fn test_drop_source_serialization_variants() {
        let sources = vec![
            (DropSource::ShareSheet, "sharesheet"),
            (DropSource::Hotkey, "hotkey"),
            (DropSource::Browser, "browser"),
            (DropSource::Manual, "manual"),
        ];

        for (source, expected) in sources {
            let json = serde_json::to_string(&source).unwrap();
            assert!(json.contains(expected), "Expected {} in {}", expected, json);
            let parsed: DropSource = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, source);
        }
    }

    #[test]
    fn test_drop_status_serialization_variants() {
        let statuses = vec![
            (DropStatus::Raw, "raw"),
            (DropStatus::Processed, "processed"),
            (DropStatus::Archived, "archived"),
        ];

        for (status, expected) in statuses {
            let json = serde_json::to_string(&status).unwrap();
            assert!(json.contains(expected));
            let parsed: DropStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, status);
        }
    }

    #[test]
    fn test_drop_camelcase_serialization() {
        let drop = Drop {
            id: Uuid::new_v4(),
            content: DropContent::Text { text: "test".to_string() },
            metadata: DropMetadata {
                source: DropSource::Manual,
                tags: vec![],
                related_framework_ids: vec![Uuid::new_v4()],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Raw,
            remote_id: None,
            synced_at: None,
        };

        let json = serde_json::to_string(&drop).unwrap();
        // camelCase fields should appear in JSON
        assert!(json.contains("createdAt"), "Expected createdAt in JSON");
        assert!(json.contains("updatedAt"), "Expected updatedAt in JSON");
        assert!(json.contains("relatedFrameworkIds"), "Expected relatedFrameworkIds in JSON");
        assert!(json.contains("remoteId"), "Expected remoteId in JSON");
        assert!(json.contains("syncedAt"), "Expected syncedAt in JSON");
    }

    #[test]
    fn test_drop_backward_compat_deserialization() {
        // Old JSON without sync fields should deserialize with None
        let json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "content": {"type": "text", "text": "old drop"},
            "metadata": {"source": "manual", "tags": [], "relatedFrameworkIds": []},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "status": "raw"
        }"#;
        let drop: Drop = serde_json::from_str(json).unwrap();
        assert!(drop.remote_id.is_none());
        assert!(drop.synced_at.is_none());
    }

    #[test]
    fn test_drop_with_sync_fields_roundtrip() {
        let drop = Drop {
            id: Uuid::new_v4(),
            content: DropContent::Text { text: "synced".to_string() },
            metadata: DropMetadata {
                source: DropSource::Browser,
                tags: vec![],
                related_framework_ids: vec![],
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: DropStatus::Processed,
            remote_id: Some("remote-123".to_string()),
            synced_at: Some(Utc::now()),
        };

        let json = serde_json::to_string(&drop).unwrap();
        let parsed: Drop = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.remote_id, Some("remote-123".to_string()));
        assert!(parsed.synced_at.is_some());
    }

    #[test]
    fn test_drop_image_no_ocr() {
        let content = DropContent::Image {
            path: PathBuf::from("/tmp/photo.jpg"),
            ocr_text: None,
        };
        let json = serde_json::to_string(&content).unwrap();
        let parsed: DropContent = serde_json::from_str(&json).unwrap();

        if let DropContent::Image { ocr_text, .. } = parsed {
            assert!(ocr_text.is_none());
        } else {
            panic!("Expected Image variant");
        }
    }
}
