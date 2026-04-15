// src-tauri/src/storage/index.rs
//! SQLite-based storage index replacing full-directory-scan index.json files.
//! Provides incremental operations, full-text search (FTS5), and paginated queries.

use rusqlite::{params, Connection};
use std::sync::Mutex;
use crate::error::{AppError, Result};

/// SQLite-backed storage index for drops, frameworks, and conversations.
pub struct StorageIndex {
    conn: Mutex<Connection>,
}

/// Paginated result with total count.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

/// Search result for drops.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DropSearchResult {
    pub id: String,
    pub content_type: String,
    pub preview: String,
    pub status: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Framework index row.
#[derive(Debug, Clone, serde::Serialize)]
pub struct FrameworkIndexRow {
    pub id: String,
    pub title: String,
    pub description: String,
    pub structure_type: String,
    pub lifecycle: String,
    pub node_count: i64,
    pub edge_count: i64,
    pub drop_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Conversation index row.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ConversationIndexRow {
    pub id: String,
    pub framework_id: Option<String>,
    pub summary: String,
    pub message_count: i64,
    pub provider: String,
    pub model: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Parameters for indexing a drop.
pub struct DropIndexParams<'a> {
    pub id: &'a str,
    pub content_type: &'a str,
    pub preview: &'a str,
    pub searchable_text: &'a str,
    pub status: &'a str,
    pub source: &'a str,
    pub tags: &'a str,
    pub related_framework_ids: &'a str,
    pub created_at: &'a str,
    pub updated_at: &'a str,
    pub remote_id: Option<&'a str>,
    pub synced_at: Option<&'a str>,
}

/// Parameters for indexing a framework.
pub struct FrameworkIndexParams<'a> {
    pub id: &'a str,
    pub title: &'a str,
    pub description: &'a str,
    pub structure_type: &'a str,
    pub lifecycle: &'a str,
    pub node_count: usize,
    pub edge_count: usize,
    pub drop_count: usize,
    pub created_at: &'a str,
    pub updated_at: &'a str,
}

/// Parameters for indexing a conversation.
pub struct ConversationIndexParams<'a> {
    pub id: &'a str,
    pub framework_id: Option<&'a str>,
    pub summary: &'a str,
    pub message_count: usize,
    pub provider: &'a str,
    pub model: &'a str,
    pub created_at: &'a str,
    pub updated_at: &'a str,
}

/// Type alias for boxed SQL parameter lists.
type SqlParams = Vec<Box<dyn rusqlite::types::ToSql>>;

impl StorageIndex {
    /// Create or open a StorageIndex at the given database path.
    pub fn new(db_path: &std::path::Path) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Io(format!("Failed to create DB directory: {}", e)))?;
        }

        let conn = Connection::open(db_path)
            .map_err(|e| AppError::Storage(format!("Failed to open SQLite: {}", e)))?;

        // Enable WAL mode for better concurrent performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| AppError::Storage(format!("Failed to set pragmas: {}", e)))?;

        let index = Self {
            conn: Mutex::new(conn),
        };
        index.create_tables()?;
        Ok(index)
    }

    /// Create database tables if they don't exist.
    fn create_tables(&self) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS drops (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                preview TEXT NOT NULL DEFAULT '',
                searchable_text TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'raw',
                source TEXT NOT NULL DEFAULT 'manual',
                tags TEXT NOT NULL DEFAULT '[]',
                related_framework_ids TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                remote_id TEXT,
                synced_at TEXT
            );

            CREATE TABLE IF NOT EXISTS frameworks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                structure_type TEXT NOT NULL DEFAULT 'custom',
                lifecycle TEXT NOT NULL DEFAULT 'draft',
                node_count INTEGER NOT NULL DEFAULT 0,
                edge_count INTEGER NOT NULL DEFAULT 0,
                drop_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                framework_id TEXT,
                summary TEXT NOT NULL DEFAULT '',
                message_count INTEGER NOT NULL DEFAULT 0,
                provider TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_drops_status ON drops(status);
            CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops(created_at);
            CREATE INDEX IF NOT EXISTS idx_drops_remote_id ON drops(remote_id);
            CREATE INDEX IF NOT EXISTS idx_frameworks_lifecycle ON frameworks(lifecycle);
            CREATE INDEX IF NOT EXISTS idx_conversations_framework_id ON conversations(framework_id);
            "
        ).map_err(|e| AppError::Storage(format!("Failed to create tables: {}", e)))?;

        // FTS5 virtual table for drop text search (idempotent)
        let fts_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='drops_fts'",
                [],
                |row| row.get::<_, bool>(0),
            )
            .unwrap_or(false);

        if !fts_exists {
            conn.execute_batch(
                "CREATE VIRTUAL TABLE drops_fts USING fts5(
                    id UNINDEXED,
                    searchable_text,
                    preview,
                    content='drops',
                    content_rowid='rowid'
                );

                CREATE TRIGGER drops_fts_insert AFTER INSERT ON drops BEGIN
                    INSERT INTO drops_fts(rowid, id, searchable_text, preview)
                    VALUES (new.rowid, new.id, new.searchable_text, new.preview);
                END;

                CREATE TRIGGER drops_fts_delete AFTER DELETE ON drops BEGIN
                    INSERT INTO drops_fts(drops_fts, rowid, id, searchable_text, preview)
                    VALUES ('delete', old.rowid, old.id, old.searchable_text, old.preview);
                END;

                CREATE TRIGGER drops_fts_update AFTER UPDATE ON drops BEGIN
                    INSERT INTO drops_fts(drops_fts, rowid, id, searchable_text, preview)
                    VALUES ('delete', old.rowid, old.id, old.searchable_text, old.preview);
                    INSERT INTO drops_fts(rowid, id, searchable_text, preview)
                    VALUES (new.rowid, new.id, new.searchable_text, new.preview);
                END;"
            ).map_err(|e| AppError::Storage(format!("Failed to create FTS5: {}", e)))?;
        }

        Ok(())
    }

    // --- Drop operations ---

    /// Index (upsert) a drop into the SQLite index.
    pub fn index_drop(&self, p: &DropIndexParams<'_>) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute(
            "INSERT INTO drops (id, content_type, preview, searchable_text, status, source, tags, related_framework_ids, created_at, updated_at, remote_id, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                content_type = excluded.content_type,
                preview = excluded.preview,
                searchable_text = excluded.searchable_text,
                status = excluded.status,
                source = excluded.source,
                tags = excluded.tags,
                related_framework_ids = excluded.related_framework_ids,
                updated_at = excluded.updated_at,
                remote_id = excluded.remote_id,
                synced_at = excluded.synced_at",
            params![p.id, p.content_type, p.preview, p.searchable_text, p.status, p.source, p.tags, p.related_framework_ids, p.created_at, p.updated_at, p.remote_id, p.synced_at],
        ).map_err(|e| AppError::Storage(format!("Failed to index drop: {}", e)))?;

        Ok(())
    }

    /// Remove a drop from the index.
    pub fn remove_drop(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute("DELETE FROM drops WHERE id = ?1", params![id])
            .map_err(|e| AppError::Storage(format!("Failed to remove drop: {}", e)))?;

        Ok(())
    }

    /// Search drops using FTS5 full-text search.
    pub fn search_drops(&self, query: &str, limit: usize, offset: usize) -> Result<PaginatedResult<DropSearchResult>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        // Build FTS5 query: tokenize input for matching
        let fts_query = query.split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|s| format!("\"{}\"*", s.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" ");

        if fts_query.is_empty() {
            return Ok(PaginatedResult { items: vec![], total: 0, limit, offset });
        }

        let count_sql = "SELECT COUNT(*) FROM drops_fts WHERE drops_fts MATCH ?1";
        let total: usize = conn
            .query_row(count_sql, params![fts_query], |row| row.get::<_, usize>(0))
            .unwrap_or(0);

        let sql = "SELECT d.id, d.content_type, d.preview, d.status, d.source, d.created_at, d.updated_at
                   FROM drops d
                   INNER JOIN drops_fts fts ON d.id = fts.id
                   WHERE drops_fts MATCH ?1
                   ORDER BY d.created_at DESC
                   LIMIT ?2 OFFSET ?3";

        let mut stmt = conn.prepare(sql)
            .map_err(|e| AppError::Storage(format!("Failed to prepare search: {}", e)))?;

        let items = stmt.query_map(params![fts_query, limit, offset], |row| {
            Ok(DropSearchResult {
                id: row.get(0)?,
                content_type: row.get(1)?,
                preview: row.get(2)?,
                status: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        }).map_err(|e| AppError::Storage(format!("Search query failed: {}", e)))?
          .filter_map(|r| r.ok())
          .collect();

        Ok(PaginatedResult { items, total, limit, offset })
    }

    /// List drops with optional status filter and pagination.
    pub fn list_drops_paginated(
        &self,
        status: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<PaginatedResult<DropSearchResult>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let (count_sql, data_sql, params_count, params_data): (
            &str, &str, SqlParams, SqlParams
        ) = if let Some(s) = status {
            (
                "SELECT COUNT(*) FROM drops WHERE status = ?1",
                "SELECT id, content_type, preview, status, source, created_at, updated_at
                 FROM drops WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
                vec![Box::new(s.to_string())],
                vec![Box::new(s.to_string()), Box::new(limit.to_string()), Box::new(offset.to_string())],
            )
        } else {
            (
                "SELECT COUNT(*) FROM drops",
                "SELECT id, content_type, preview, status, source, created_at, updated_at
                 FROM drops ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
                vec![],
                vec![Box::new(limit.to_string()), Box::new(offset.to_string())],
            )
        };

        let total: usize = if params_count.is_empty() {
            conn.query_row(count_sql, [], |row| row.get::<_, usize>(0)).unwrap_or(0)
        } else {
            let params_ref: Vec<&dyn rusqlite::types::ToSql> = params_count.iter().map(|p| p.as_ref()).collect();
            conn.query_row(count_sql, params_ref.as_slice(), |row| row.get::<_, usize>(0)).unwrap_or(0)
        };

        let params_ref: Vec<&dyn rusqlite::types::ToSql> = params_data.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(data_sql)
            .map_err(|e| AppError::Storage(format!("Failed to prepare paginated query: {}", e)))?;

        let items = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(DropSearchResult {
                id: row.get(0)?,
                content_type: row.get(1)?,
                preview: row.get(2)?,
                status: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        }).map_err(|e| AppError::Storage(format!("Paginated query failed: {}", e)))?
          .filter_map(|r| r.ok())
          .collect();

        Ok(PaginatedResult { items, total, limit, offset })
    }

    /// Find a drop by its remote_id (from sync server).
    pub fn find_by_remote_id(&self, remote_id: &str) -> Result<Option<DropSearchResult>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, content_type, preview, status, source, created_at, updated_at
             FROM drops WHERE remote_id = ?1"
        ).map_err(|e| AppError::Storage(format!("Failed to prepare find_by_remote_id: {}", e)))?;

        let result = stmt.query_row(params![remote_id], |row| {
            Ok(DropSearchResult {
                id: row.get(0)?,
                content_type: row.get(1)?,
                preview: row.get(2)?,
                status: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        });

        match result {
            Ok(r) => Ok(Some(r)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Storage(format!("find_by_remote_id failed: {}", e))),
        }
    }

    /// Find drops that need sync (synced_at is NULL or synced_at < updated_at).
    pub fn find_unsynced_drops(&self) -> Result<Vec<DropSearchResult>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, content_type, preview, status, source, created_at, updated_at
             FROM drops
             WHERE synced_at IS NULL OR synced_at < updated_at
             ORDER BY updated_at ASC"
        ).map_err(|e| AppError::Storage(format!("Failed to prepare find_unsynced_drops: {}", e)))?;

        let items = stmt.query_map([], |row| {
            Ok(DropSearchResult {
                id: row.get(0)?,
                content_type: row.get(1)?,
                preview: row.get(2)?,
                status: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        }).map_err(|e| AppError::Storage(format!("find_unsynced_drops failed: {}", e)))?
          .filter_map(|r| r.ok())
          .collect();

        Ok(items)
    }

    // --- Framework operations ---

    /// Index (upsert) a framework.
    pub fn index_framework(&self, p: &FrameworkIndexParams<'_>) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute(
            "INSERT INTO frameworks (id, title, description, structure_type, lifecycle, node_count, edge_count, drop_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                structure_type = excluded.structure_type,
                lifecycle = excluded.lifecycle,
                node_count = excluded.node_count,
                edge_count = excluded.edge_count,
                drop_count = excluded.drop_count,
                updated_at = excluded.updated_at",
            params![p.id, p.title, p.description, p.structure_type, p.lifecycle, p.node_count as i64, p.edge_count as i64, p.drop_count as i64, p.created_at, p.updated_at],
        ).map_err(|e| AppError::Storage(format!("Failed to index framework: {}", e)))?;

        Ok(())
    }

    /// Remove a framework from the index.
    pub fn remove_framework(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute("DELETE FROM frameworks WHERE id = ?1", params![id])
            .map_err(|e| AppError::Storage(format!("Failed to remove framework: {}", e)))?;

        Ok(())
    }

    /// List all frameworks sorted by updated_at descending.
    pub fn list_frameworks(&self) -> Result<Vec<FrameworkIndexRow>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, title, description, structure_type, lifecycle, node_count, edge_count, drop_count, created_at, updated_at
             FROM frameworks ORDER BY updated_at DESC"
        ).map_err(|e| AppError::Storage(format!("Failed to prepare frameworks query: {}", e)))?;

        let rows = stmt.query_map([], |row| {
            Ok(FrameworkIndexRow {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                structure_type: row.get(3)?,
                lifecycle: row.get(4)?,
                node_count: row.get(5)?,
                edge_count: row.get(6)?,
                drop_count: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }).map_err(|e| AppError::Storage(format!("Frameworks query failed: {}", e)))?
          .filter_map(|r| r.ok())
          .collect();

        Ok(rows)
    }

    // --- Conversation operations ---

    /// Index (upsert) a conversation.
    pub fn index_conversation(&self, p: &ConversationIndexParams<'_>) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute(
            "INSERT INTO conversations (id, framework_id, summary, message_count, provider, model, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                framework_id = excluded.framework_id,
                summary = excluded.summary,
                message_count = excluded.message_count,
                provider = excluded.provider,
                model = excluded.model,
                updated_at = excluded.updated_at",
            params![p.id, p.framework_id, p.summary, p.message_count as i64, p.provider, p.model, p.created_at, p.updated_at],
        ).map_err(|e| AppError::Storage(format!("Failed to index conversation: {}", e)))?;

        Ok(())
    }

    /// Remove a conversation from the index.
    pub fn remove_conversation(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])
            .map_err(|e| AppError::Storage(format!("Failed to remove conversation: {}", e)))?;

        Ok(())
    }

    /// List all conversations sorted by updated_at descending.
    pub fn list_conversations(&self) -> Result<Vec<ConversationIndexRow>> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, framework_id, summary, message_count, provider, model, created_at, updated_at
             FROM conversations ORDER BY updated_at DESC"
        ).map_err(|e| AppError::Storage(format!("Failed to prepare conversations query: {}", e)))?;

        let rows = stmt.query_map([], |row| {
            Ok(ConversationIndexRow {
                id: row.get(0)?,
                framework_id: row.get(1)?,
                summary: row.get(2)?,
                message_count: row.get(3)?,
                provider: row.get(4)?,
                model: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).map_err(|e| AppError::Storage(format!("Conversations query failed: {}", e)))?
          .filter_map(|r| r.ok())
          .collect();

        Ok(rows)
    }

    /// Check if the database has been populated (for migration detection).
    pub fn is_empty(&self) -> Result<bool> {
        let conn = self.conn.lock()
            .map_err(|e| AppError::Storage(format!("Lock error: {}", e)))?;

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM drops", [], |row| row.get(0))
            .unwrap_or(0);
        let fw_count: i64 = conn.query_row("SELECT COUNT(*) FROM frameworks", [], |row| row.get(0))
            .unwrap_or(0);
        let conv_count: i64 = conn.query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
            .unwrap_or(0);

        Ok(count == 0 && fw_count == 0 && conv_count == 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_index() -> (TempDir, StorageIndex) {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("test.db");
        let index = StorageIndex::new(&db_path).unwrap();
        (dir, index)
    }

    #[test]
    fn test_create_tables() {
        let _ = make_index();
        // If we get here, tables were created successfully
    }

    #[test]
    fn test_index_and_search_drop() {
        let (_dir, index) = make_index();

        index.index_drop(&DropIndexParams {
            id: "drop-1", content_type: "text", preview: "Hello world about AI",
            searchable_text: "Hello world about AI and machine learning",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        index.index_drop(&DropIndexParams {
            id: "drop-2", content_type: "text", preview: "Note about Rust programming",
            searchable_text: "Note about Rust programming language",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-02T00:00:00Z", updated_at: "2024-01-02T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        let results = index.search_drops("AI machine", 10, 0).unwrap();
        assert_eq!(results.total, 1);
        assert_eq!(results.items[0].id, "drop-1");

        let rust_results = index.search_drops("Rust", 10, 0).unwrap();
        assert_eq!(rust_results.total, 1);
        assert_eq!(rust_results.items[0].id, "drop-2");
    }

    #[test]
    fn test_remove_drop() {
        let (_dir, index) = make_index();

        index.index_drop(&DropIndexParams {
            id: "drop-rm", content_type: "text", preview: "test", searchable_text: "test text",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        index.remove_drop("drop-rm").unwrap();

        let results = index.search_drops("test", 10, 0).unwrap();
        assert_eq!(results.total, 0);
    }

    #[test]
    fn test_list_drops_paginated() {
        let (_dir, index) = make_index();

        for i in 0..5 {
            index.index_drop(&DropIndexParams {
                id: &format!("drop-{}", i), content_type: "text",
                preview: &format!("Drop number {}", i),
                searchable_text: &format!("Drop number {} content", i),
                status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
                created_at: &format!("2024-01-0{}T00:00:00Z", i + 1),
                updated_at: &format!("2024-01-0{}T00:00:00Z", i + 1),
                remote_id: None, synced_at: None,
            }).unwrap();
        }

        // First page
        let page1 = index.list_drops_paginated(None, 3, 0).unwrap();
        assert_eq!(page1.items.len(), 3);
        assert_eq!(page1.total, 5);

        // Second page
        let page2 = index.list_drops_paginated(None, 3, 3).unwrap();
        assert_eq!(page2.items.len(), 2);

        // Filtered by status
        index.index_drop(&DropIndexParams {
            id: "drop-filtered", content_type: "text", preview: "processed drop", searchable_text: "processed",
            status: "processed", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-10T00:00:00Z", updated_at: "2024-01-10T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        let raw_only = index.list_drops_paginated(Some("raw"), 100, 0).unwrap();
        assert_eq!(raw_only.total, 5);

        let processed_only = index.list_drops_paginated(Some("processed"), 100, 0).unwrap();
        assert_eq!(processed_only.total, 1);
    }

    #[test]
    fn test_index_and_list_frameworks() {
        let (_dir, index) = make_index();

        index.index_framework(&FrameworkIndexParams {
            id: "fw-1", title: "Framework A", description: "Desc A",
            structure_type: "pyramid", lifecycle: "building",
            node_count: 5, edge_count: 3, drop_count: 2,
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z",
        }).unwrap();

        index.index_framework(&FrameworkIndexParams {
            id: "fw-2", title: "Framework B", description: "Desc B",
            structure_type: "pillars", lifecycle: "confirmed",
            node_count: 3, edge_count: 1, drop_count: 0,
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-03T00:00:00Z",
        }).unwrap();

        let frameworks = index.list_frameworks().unwrap();
        assert_eq!(frameworks.len(), 2);
        // Sorted by updated_at desc
        assert_eq!(frameworks[0].id, "fw-2");
        assert_eq!(frameworks[1].id, "fw-1");
    }

    #[test]
    fn test_remove_framework() {
        let (_dir, index) = make_index();

        index.index_framework(&FrameworkIndexParams {
            id: "fw-rm", title: "Remove Me", description: "",
            structure_type: "custom", lifecycle: "draft",
            node_count: 0, edge_count: 0, drop_count: 0,
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
        }).unwrap();

        index.remove_framework("fw-rm").unwrap();

        let frameworks = index.list_frameworks().unwrap();
        assert!(frameworks.is_empty());
    }

    #[test]
    fn test_index_and_list_conversations() {
        let (_dir, index) = make_index();

        index.index_conversation(&ConversationIndexParams {
            id: "conv-1", framework_id: Some("fw-1"), summary: "Summary 1",
            message_count: 3, provider: "openai", model: "gpt-4",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
        }).unwrap();

        index.index_conversation(&ConversationIndexParams {
            id: "conv-2", framework_id: None, summary: "Summary 2",
            message_count: 1, provider: "claude", model: "claude-3",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z",
        }).unwrap();

        let convs = index.list_conversations().unwrap();
        assert_eq!(convs.len(), 2);
        assert_eq!(convs[0].id, "conv-2"); // sorted desc by updated_at
    }

    #[test]
    fn test_remove_conversation() {
        let (_dir, index) = make_index();

        index.index_conversation(&ConversationIndexParams {
            id: "conv-rm", framework_id: None, summary: "",
            message_count: 0, provider: "openai", model: "gpt-4",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
        }).unwrap();

        index.remove_conversation("conv-rm").unwrap();

        let convs = index.list_conversations().unwrap();
        assert!(convs.is_empty());
    }

    #[test]
    fn test_upsert_drop() {
        let (_dir, index) = make_index();

        index.index_drop(&DropIndexParams {
            id: "drop-upsert", content_type: "text", preview: "original", searchable_text: "original text",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        // Upsert with new status
        index.index_drop(&DropIndexParams {
            id: "drop-upsert", content_type: "text", preview: "updated preview", searchable_text: "updated text",
            status: "processed", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        let page = index.list_drops_paginated(None, 10, 0).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].status, "processed");
        assert_eq!(page.items[0].preview, "updated preview");
    }

    #[test]
    fn test_is_empty() {
        let (_dir, index) = make_index();
        assert!(index.is_empty().unwrap());

        index.index_drop(&DropIndexParams {
            id: "drop-1", content_type: "text", preview: "test", searchable_text: "test",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        assert!(!index.is_empty().unwrap());
    }

    #[test]
    fn test_search_empty_query() {
        let (_dir, index) = make_index();

        index.index_drop(&DropIndexParams {
            id: "drop-1", content_type: "text", preview: "test", searchable_text: "test content",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        let results = index.search_drops("", 10, 0).unwrap();
        assert_eq!(results.total, 0);
        assert!(results.items.is_empty());
    }

    #[test]
    fn test_find_by_remote_id() {
        let (_dir, index) = make_index();

        index.index_drop(&DropIndexParams {
            id: "drop-local-1", content_type: "text", preview: "synced drop", searchable_text: "synced",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: Some("remote-abc"), synced_at: Some("2024-01-01T00:00:00Z"),
        }).unwrap();

        // Found
        let found = index.find_by_remote_id("remote-abc").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, "drop-local-1");

        // Not found
        let not_found = index.find_by_remote_id("remote-xyz").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_find_unsynced_drops() {
        let (_dir, index) = make_index();

        // Synced drop (synced_at == updated_at)
        index.index_drop(&DropIndexParams {
            id: "drop-synced", content_type: "text", preview: "synced", searchable_text: "synced",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
            remote_id: Some("r1"), synced_at: Some("2024-01-01T00:00:00Z"),
        }).unwrap();

        // Unsynced drop (no synced_at)
        index.index_drop(&DropIndexParams {
            id: "drop-unsynced", content_type: "text", preview: "unsynced", searchable_text: "unsynced",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z",
            remote_id: None, synced_at: None,
        }).unwrap();

        // Stale drop (synced_at < updated_at)
        index.index_drop(&DropIndexParams {
            id: "drop-stale", content_type: "text", preview: "stale", searchable_text: "stale",
            status: "raw", source: "manual", tags: "[]", related_framework_ids: "[]",
            created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-03T00:00:00Z",
            remote_id: Some("r3"), synced_at: Some("2024-01-02T00:00:00Z"),
        }).unwrap();

        let unsynced = index.find_unsynced_drops().unwrap();
        assert_eq!(unsynced.len(), 2);
        let ids: Vec<&str> = unsynced.iter().map(|d| d.id.as_str()).collect();
        assert!(ids.contains(&"drop-unsynced"));
        assert!(ids.contains(&"drop-stale"));
        assert!(!ids.contains(&"drop-synced"));
    }
}
