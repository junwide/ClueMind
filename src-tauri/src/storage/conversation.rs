// src-tauri/src/storage/conversation.rs
//! Conversation storage for AI chat history.
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use crate::error::{AppError, Result};
use crate::storage::StorageIndex;
use crate::storage::index::ConversationIndexParams;

/// A single message in a conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// A conversation with the AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub framework_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub provider: String,
    pub model: String,
    pub messages: Vec<Message>,
    pub summary: String,
}

/// Summary of a conversation for listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: String,
    pub framework_id: Option<String>,
    pub summary: String,
    pub message_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

/// Index of all conversations (legacy, kept for fallback).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct ConversationIndex {
    conversations: Vec<ConversationSummary>,
    last_updated: String,
}

/// Storage for conversations.
pub struct ConversationStorage {
    base_path: PathBuf,
    storage_index: Option<Arc<StorageIndex>>,
}

impl ConversationStorage {
    /// Create a new conversation storage.
    pub fn new(base_path: PathBuf) -> Self {
        Self {
            base_path: base_path.join("conversations"),
            storage_index: None,
        }
    }

    /// Set the StorageIndex for incremental indexing.
    pub fn set_storage_index(&mut self, index: Arc<StorageIndex>) {
        self.storage_index = Some(index);
    }

    /// Get the base path for conversation storage.
    pub fn base_path(&self) -> &PathBuf {
        &self.base_path
    }

    /// Save a conversation.
    pub fn save(&self, conversation: &Conversation) -> Result<()> {
        fs::create_dir_all(&self.base_path)
            .map_err(|e| AppError::Storage(format!("Failed to create dir: {}", e)))?;

        let file_path = self.base_path.join(format!("{}.json", conversation.id));
        let content = serde_json::to_string_pretty(conversation)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        fs::write(&file_path, content)
            .map_err(|e| AppError::Storage(format!("Failed to write: {}", e)))?;

        self.update_index_incremental(conversation)?;
        Ok(())
    }

    /// Load a conversation by ID.
    pub fn load(&self, id: &str) -> Result<Conversation> {
        let file_path = self.base_path.join(format!("{}.json", id));
        let content = fs::read_to_string(&file_path)
            .map_err(|e| AppError::Storage(format!("Failed to read: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| AppError::Serialization(e.to_string()))
    }

    /// Load all conversations for a framework.
    pub fn load_by_framework(&self, framework_id: &str) -> Result<Vec<Conversation>> {
        let index = self.load_index()?;
        let conversations: Vec<Conversation> = index
            .conversations
            .into_iter()
            .filter(|s| s.framework_id.as_deref() == Some(framework_id))
            .filter_map(|s| self.load(&s.id).ok())
            .collect();

        Ok(conversations)
    }

    /// List all conversation summaries.
    pub fn list(&self) -> Result<Vec<ConversationSummary>> {
        let index = self.load_index()?;
        Ok(index.conversations)
    }

    /// Delete a conversation by ID.
    pub fn delete(&self, id: &str) -> Result<()> {
        let file_path = self.base_path.join(format!("{}.json", id));
        fs::remove_file(&file_path)
            .map_err(|e| AppError::Storage(format!("Failed to delete: {}", e)))?;

        self.remove_index_entry(id)?;
        Ok(())
    }

    /// Update index incrementally using StorageIndex, or fall back to full rebuild.
    fn update_index_incremental(&self, conversation: &Conversation) -> Result<()> {
        if let Some(ref idx) = self.storage_index {
            idx.index_conversation(&ConversationIndexParams {
                id: &conversation.id,
                framework_id: conversation.framework_id.as_deref(),
                summary: &conversation.summary,
                message_count: conversation.messages.len(),
                provider: &conversation.provider,
                model: &conversation.model,
                created_at: &conversation.created_at,
                updated_at: &conversation.updated_at,
            })?;
        } else {
            self.update_index()?;
        }
        Ok(())
    }

    /// Remove entry from index using StorageIndex, or fall back to full rebuild.
    fn remove_index_entry(&self, id: &str) -> Result<()> {
        if let Some(ref idx) = self.storage_index {
            idx.remove_conversation(id)?;
        } else {
            self.update_index()?;
        }
        Ok(())
    }

    fn load_index(&self) -> Result<ConversationIndex> {
        let index_path = self.base_path.join("index.json");
        if !index_path.exists() {
            return Ok(ConversationIndex::default());
        }

        let content = fs::read_to_string(&index_path)
            .map_err(|e| AppError::Storage(format!("Failed to read index: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| AppError::Serialization(e.to_string()))
    }

    fn update_index(&self) -> Result<()> {
        let mut conversations = Vec::new();

        if self.base_path.exists() {
            for entry in fs::read_dir(&self.base_path)
                .map_err(|e| AppError::Storage(format!("Failed to read dir: {}", e)))?
            {
                let entry = entry.map_err(|e| AppError::Storage(e.to_string()))?;
                let path = entry.path();

                if path.extension().map(|e| e == "json").unwrap_or(false)
                    && path.file_name().map(|n| n != "index.json").unwrap_or(true)
                {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(conv) = serde_json::from_str::<Conversation>(&content) {
                            conversations.push(ConversationSummary {
                                id: conv.id,
                                framework_id: conv.framework_id,
                                summary: conv.summary,
                                message_count: conv.messages.len(),
                                created_at: conv.created_at,
                                updated_at: conv.updated_at,
                            });
                        }
                    }
                }
            }
        }

        conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        let index = ConversationIndex {
            conversations,
            last_updated: Utc::now().to_rfc3339(),
        };

        let index_path = self.base_path.join("index.json");
        let content = serde_json::to_string_pretty(&index)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        fs::write(&index_path, content)
            .map_err(|e| AppError::Storage(format!("Failed to write index: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load_conversation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conversation = Conversation {
            id: "conv-1".to_string(),
            framework_id: Some("fw-1".to_string()),
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![],
            summary: "Test conversation".to_string(),
        };

        storage.save(&conversation).unwrap();
        let loaded = storage.load("conv-1").unwrap();

        assert_eq!(loaded.id, "conv-1");
        assert_eq!(loaded.provider, "openai");
    }

    #[test]
    fn test_list_conversations() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conv1 = Conversation {
            id: "conv-1".to_string(),
            framework_id: None,
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![],
            summary: "First".to_string(),
        };

        let conv2 = Conversation {
            id: "conv-2".to_string(),
            framework_id: None,
            created_at: "2024-03-29T13:00:00Z".to_string(),
            updated_at: "2024-03-29T13:00:00Z".to_string(),
            provider: "claude".to_string(),
            model: "claude-3".to_string(),
            messages: vec![],
            summary: "Second".to_string(),
        };

        storage.save(&conv1).unwrap();
        storage.save(&conv2).unwrap();

        let list = storage.list().unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn test_delete_conversation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conversation = Conversation {
            id: "conv-1".to_string(),
            framework_id: None,
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![],
            summary: "Test".to_string(),
        };

        storage.save(&conversation).unwrap();
        storage.delete("conv-1").unwrap();

        let result = storage.load("conv-1");
        assert!(result.is_err());
    }

    #[test]
    fn test_load_missing_conversation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let result = storage.load("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_nonexistent_conversation_errors() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let result = storage.delete("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_conversation_with_messages() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conversation = Conversation {
            id: "conv-msgs".to_string(),
            framework_id: None,
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![
                Message {
                    id: "msg-1".to_string(),
                    role: "user".to_string(),
                    content: "Hello".to_string(),
                    timestamp: "2024-03-29T12:00:01Z".to_string(),
                    metadata: None,
                },
                Message {
                    id: "msg-2".to_string(),
                    role: "assistant".to_string(),
                    content: "Hi there!".to_string(),
                    timestamp: "2024-03-29T12:00:02Z".to_string(),
                    metadata: Some(serde_json::json!({"tokens": 42})),
                },
            ],
            summary: "A greeting".to_string(),
        };

        storage.save(&conversation).unwrap();
        let loaded = storage.load("conv-msgs").unwrap();

        assert_eq!(loaded.messages.len(), 2);
        assert_eq!(loaded.messages[0].role, "user");
        assert_eq!(loaded.messages[0].content, "Hello");
        assert_eq!(loaded.messages[1].role, "assistant");
        assert_eq!(loaded.messages[1].content, "Hi there!");
        assert!(loaded.messages[1].metadata.is_some());
    }

    #[test]
    fn test_load_by_framework() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conv1 = Conversation {
            id: "conv-fw1".to_string(),
            framework_id: Some("fw-1".to_string()),
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![],
            summary: "For fw-1".to_string(),
        };

        let conv2 = Conversation {
            id: "conv-fw2".to_string(),
            framework_id: Some("fw-2".to_string()),
            created_at: "2024-03-29T13:00:00Z".to_string(),
            updated_at: "2024-03-29T13:00:00Z".to_string(),
            provider: "claude".to_string(),
            model: "claude-3".to_string(),
            messages: vec![],
            summary: "For fw-2".to_string(),
        };

        let conv3 = Conversation {
            id: "conv-no-fw".to_string(),
            framework_id: None,
            created_at: "2024-03-29T14:00:00Z".to_string(),
            updated_at: "2024-03-29T14:00:00Z".to_string(),
            provider: "glm".to_string(),
            model: "glm-4".to_string(),
            messages: vec![],
            summary: "No framework".to_string(),
        };

        storage.save(&conv1).unwrap();
        storage.save(&conv2).unwrap();
        storage.save(&conv3).unwrap();

        let fw1_convs = storage.load_by_framework("fw-1").unwrap();
        assert_eq!(fw1_convs.len(), 1);
        assert_eq!(fw1_convs[0].id, "conv-fw1");

        let fw2_convs = storage.load_by_framework("fw-2").unwrap();
        assert_eq!(fw2_convs.len(), 1);
        assert_eq!(fw2_convs[0].id, "conv-fw2");

        let none_convs = storage.load_by_framework("fw-999").unwrap();
        assert!(none_convs.is_empty());
    }

    #[test]
    fn test_list_conversations_summary_fields() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let conv = Conversation {
            id: "conv-summary".to_string(),
            framework_id: Some("fw-x".to_string()),
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![
                Message {
                    id: "m1".to_string(),
                    role: "user".to_string(),
                    content: "a".to_string(),
                    timestamp: "2024-03-29T12:00:01Z".to_string(),
                    metadata: None,
                },
                Message {
                    id: "m2".to_string(),
                    role: "assistant".to_string(),
                    content: "b".to_string(),
                    timestamp: "2024-03-29T12:00:02Z".to_string(),
                    metadata: None,
                },
                Message {
                    id: "m3".to_string(),
                    role: "user".to_string(),
                    content: "c".to_string(),
                    timestamp: "2024-03-29T12:00:03Z".to_string(),
                    metadata: None,
                },
            ],
            summary: "Three messages".to_string(),
        };

        storage.save(&conv).unwrap();
        let summaries = storage.list().unwrap();

        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].message_count, 3);
        assert_eq!(summaries[0].summary, "Three messages");
        assert_eq!(summaries[0].id, "conv-summary");
        assert_eq!(summaries[0].framework_id, Some("fw-x".to_string()));
    }

    #[test]
    fn test_save_and_overwrite_conversation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ConversationStorage::new(temp_dir.path().to_path_buf());

        let mut conv = Conversation {
            id: "conv-overwrite".to_string(),
            framework_id: None,
            created_at: "2024-03-29T12:00:00Z".to_string(),
            updated_at: "2024-03-29T12:00:00Z".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4".to_string(),
            messages: vec![],
            summary: "Original".to_string(),
        };

        storage.save(&conv).unwrap();

        conv.summary = "Updated summary".to_string();
        conv.messages.push(Message {
            id: "m1".to_string(),
            role: "user".to_string(),
            content: "new message".to_string(),
            timestamp: "2024-03-29T12:01:00Z".to_string(),
            metadata: None,
        });
        storage.save(&conv).unwrap();

        let loaded = storage.load("conv-overwrite").unwrap();
        assert_eq!(loaded.summary, "Updated summary");
        assert_eq!(loaded.messages.len(), 1);

        // Index should still have 1 conversation
        let list = storage.list().unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_message_serialization_with_metadata() {
        let msg = Message {
            id: "msg-1".to_string(),
            role: "assistant".to_string(),
            content: "response".to_string(),
            timestamp: "2024-03-29T12:00:00Z".to_string(),
            metadata: Some(serde_json::json!({
                "model": "gpt-4",
                "tokens": 150,
                "finish_reason": "stop"
            })),
        };

        let json = serde_json::to_string(&msg).unwrap();
        let parsed: Message = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, "msg-1");
        assert_eq!(parsed.role, "assistant");
        assert!(parsed.metadata.is_some());
        let meta = parsed.metadata.unwrap();
        assert_eq!(meta["model"], "gpt-4");
        assert_eq!(meta["tokens"], 150);
    }

    #[test]
    fn test_message_serialization_without_metadata() {
        let msg = Message {
            id: "msg-2".to_string(),
            role: "user".to_string(),
            content: "hello".to_string(),
            timestamp: "2024-03-29T12:00:00Z".to_string(),
            metadata: None,
        };

        let json = serde_json::to_string(&msg).unwrap();
        // metadata should be skipped when None
        assert!(!json.contains("metadata"));
        let parsed: Message = serde_json::from_str(&json).unwrap();
        assert!(parsed.metadata.is_none());
    }
}
