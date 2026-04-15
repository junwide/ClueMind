// src-tauri/src/sync/sync_client.rs
//! HTTP client wrapper for ClueMind-Server API calls.

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use crate::error::{AppError, Result};

/// HTTP request timeout (30 seconds).
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
/// HTTP connection timeout (10 seconds).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// A single drop returned from the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDrop {
    pub id: String,
    pub content: ServerDropContent,
    pub metadata: ServerDropMetadata,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

/// Drop content from server (tagged union).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ServerDropContent {
    Text { text: String },
    Url { url: String, title: Option<String> },
    Image { path: String, ocr_text: Option<String> },
    File { path: String, file_type: Option<String> },
    Voice { path: String, transcription: Option<String> },
}

/// Drop metadata from server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDropMetadata {
    pub source: String,
    pub tags: Vec<String>,
    pub related_framework_ids: Vec<String>,
}

/// Paginated response from list drops API.
#[derive(Debug, Clone, Deserialize)]
pub struct ServerDropListResponse {
    pub items: Vec<ServerDrop>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

/// Update payload for PUT /api/v1/drops/:id.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDropUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// HTTP client for ClueMind-Server.
pub struct SyncClient {
    client: Client,
    base_url: String,
    token: String,
}

impl SyncClient {
    pub fn new(base_url: &str, token: &str) -> Self {
        let client = Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
    }

    /// GET /health — verify connectivity (with auth).
    pub async fn health_check(&self) -> Result<String> {
        let url = format!("{}/health", self.base_url);
        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| AppError::Api(format!("Health check failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Health check failed: {} {}", status, body)));
        }

        let body: serde_json::Value = response.json().await
            .map_err(|e| AppError::Api(format!("Invalid response: {}", e)))?;
        let version = body["version"].as_str().unwrap_or("unknown");
        Ok(format!("Connected to ClueMind Server v{}", version))
    }

    /// GET /api/v1/drops?updated_since=...&limit=...&offset=...
    pub async fn list_drops(
        &self,
        updated_since: Option<&DateTime<Utc>>,
        limit: usize,
        offset: usize,
    ) -> Result<ServerDropListResponse> {
        let mut url = format!("{}/api/v1/drops?limit={}&offset={}", self.base_url, limit, offset);
        if let Some(since) = updated_since {
            url.push_str(&format!("&updated_since={}", since.to_rfc3339()));
        }

        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| AppError::Api(format!("List drops failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("List drops error {}: {}", status, body)));
        }

        response.json::<ServerDropListResponse>().await
            .map_err(|e| AppError::Api(format!("Invalid response: {}", e)))
    }

    /// POST /api/v1/drops/text
    pub async fn create_text_drop(&self, text: &str) -> Result<ServerDrop> {
        let url = format!("{}/api/v1/drops/text", self.base_url);
        let body = serde_json::json!({ "text": text });

        self.post_create(&url, &body).await
    }

    /// POST /api/v1/drops/url
    pub async fn create_url_drop(&self, url: &str, title: Option<&str>) -> Result<ServerDrop> {
        let api_url = format!("{}/api/v1/drops/url", self.base_url);
        let mut body = serde_json::json!({ "url": url });
        if let Some(t) = title {
            body["title"] = serde_json::Value::String(t.to_string());
        }

        self.post_create(&api_url, &body).await
    }

    /// POST /api/v1/drops/image (multipart)
    pub async fn create_image_drop(&self, file_path: &Path, ocr_text: Option<&str>) -> Result<ServerDrop> {
        let url = format!("{}/api/v1/drops/image", self.base_url);
        self.upload_file(&url, file_path, "ocr_text", ocr_text).await
    }

    /// POST /api/v1/drops/file (multipart)
    pub async fn create_file_drop(&self, file_path: &Path, file_type: &str) -> Result<ServerDrop> {
        let url = format!("{}/api/v1/drops/file", self.base_url);
        self.upload_file(&url, file_path, "file_type", Some(file_type)).await
    }

    /// POST /api/v1/drops/voice (multipart)
    pub async fn create_voice_drop(&self, file_path: &Path, transcription: Option<&str>) -> Result<ServerDrop> {
        let url = format!("{}/api/v1/drops/voice", self.base_url);
        self.upload_file(&url, file_path, "transcription", transcription).await
    }

    /// PUT /api/v1/drops/:id
    pub async fn update_drop(&self, remote_id: &str, update: &ServerDropUpdate) -> Result<ServerDrop> {
        let url = format!("{}/api/v1/drops/{}", self.base_url, remote_id);

        let response = self.client
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(update)
            .send()
            .await
            .map_err(|e| AppError::Api(format!("Update drop failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Update drop error {}: {}", status, body)));
        }

        response.json::<ServerDrop>().await
            .map_err(|e| AppError::Api(format!("Invalid response: {}", e)))
    }

    /// DELETE /api/v1/drops/:id
    pub async fn delete_drop(&self, remote_id: &str) -> Result<()> {
        let url = format!("{}/api/v1/drops/{}", self.base_url, remote_id);

        let response = self.client
            .delete(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| AppError::Api(format!("Delete drop failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Delete drop error {}: {}", status, body)));
        }

        Ok(())
    }

    // --- Internal helpers ---

    async fn post_create(&self, url: &str, body: &serde_json::Value) -> Result<ServerDrop> {
        let response = self.client
            .post(url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| AppError::Api(format!("Create drop failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Create drop error {}: {}", status, body)));
        }

        response.json::<ServerDrop>().await
            .map_err(|e| AppError::Api(format!("Invalid response: {}", e)))
    }

    async fn upload_file(
        &self,
        url: &str,
        file_path: &Path,
        extra_field: &str,
        extra_value: Option<&str>,
    ) -> Result<ServerDrop> {
        let file_bytes = std::fs::read(file_path)
            .map_err(|e| AppError::Io(format!("Failed to read file {:?}: {}", file_path, e)))?;
        let file_name = file_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("upload")
            .to_string();

        let mut form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(file_bytes).file_name(file_name));

        if let Some(val) = extra_value {
            form = form.text(extra_field.to_string(), val.to_string());
        }

        let response = self.client
            .post(url)
            .header("Authorization", self.auth_header())
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Api(format!("Upload failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Upload error {}: {}", status, body)));
        }

        response.json::<ServerDrop>().await
            .map_err(|e| AppError::Api(format!("Invalid response: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_client_construction() {
        let client = SyncClient::new("http://localhost:3817", "my-token");
        assert_eq!(client.base_url, "http://localhost:3817");
        assert_eq!(client.token, "my-token");
    }

    #[test]
    fn test_sync_client_trims_trailing_slash() {
        let client = SyncClient::new("http://localhost:3817/", "tok");
        assert_eq!(client.base_url, "http://localhost:3817");
    }

    #[test]
    fn test_server_drop_deserialization() {
        let json = r#"{
            "id": "abc-123",
            "content": {"type": "text", "text": "Hello"},
            "metadata": {"source": "manual", "tags": ["test"], "relatedFrameworkIds": []},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-02T00:00:00Z",
            "status": "raw"
        }"#;

        let drop: ServerDrop = serde_json::from_str(json).unwrap();
        assert_eq!(drop.id, "abc-123");
        assert!(matches!(drop.content, ServerDropContent::Text { ref text } if text == "Hello"));
        assert_eq!(drop.status, "raw");
    }

    #[test]
    fn test_server_drop_url_deserialization() {
        let json = r#"{
            "id": "url-1",
            "content": {"type": "url", "url": "https://example.com", "title": "Example"},
            "metadata": {"source": "browser", "tags": [], "relatedFrameworkIds": []},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "status": "raw"
        }"#;

        let drop: ServerDrop = serde_json::from_str(json).unwrap();
        if let ServerDropContent::Url { url, title } = &drop.content {
            assert_eq!(url, "https://example.com");
            assert_eq!(title.as_deref(), Some("Example"));
        } else {
            panic!("Expected Url variant");
        }
    }

    #[test]
    fn test_server_drop_list_response() {
        let json = r#"{
            "items": [],
            "total": 42,
            "limit": 50,
            "offset": 0
        }"#;

        let resp: ServerDropListResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.total, 42);
        assert!(resp.items.is_empty());
    }

    #[test]
    fn test_server_drop_update_serialization() {
        let update = ServerDropUpdate {
            content: None,
            status: Some("processed".to_string()),
            tags: Some(vec!["tag1".to_string()]),
        };
        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("processed"));
        assert!(!json.contains("content")); // skip_serializing_if
    }
}
