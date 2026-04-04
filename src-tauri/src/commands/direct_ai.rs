// src-tauri/src/commands/direct_ai.rs
//! Direct AI commands that call LLM APIs.
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::error::{AppError, Result};

/// Safely truncate a string to a maximum number of characters (not bytes),
/// respecting UTF-8 character boundaries.
fn truncate_chars(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// OpenAI-style request
#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
}

// OpenAI-style response
#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

 #[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

 #[derive(Debug, Deserialize)]
struct OpenAIMessage {
    #[serde(default)]
    content: Option<String>,
}

// Anthropic-style request
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

// Anthropic-style response
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

 #[derive(Debug, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

/// Prompt configuration for AI commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptConfig {
    pub framework_prompt: String,
    pub refine_prompt: String,
}

impl Default for PromptConfig {
    fn default() -> Self {
        PromptConfig {
            framework_prompt: r#"你是一位知识架构伙伴。你的任务是基于用户提供的素材，帮助构建有价值的知识框架。

请按以下两步完成：

第一步：思考分析（用自然语言）
- 分析素材中的核心主题、关键观点和重要信息
- 发现素材之间的关联、矛盾或互补关系
- 用伙伴语气说明你准备如何组织这个框架以及为什么选择这种结构
- 用中文思考和分析

第二步：输出框架（纯 JSON）
在思考分析之后，直接输出 JSON 格式的框架数据。

JSON schema:
{
  "frameworks": [{
    "id": "string",
    "title": "string",
    "description": "string",
    "structure_type": "pyramid" | "pillars" | "custom",
    "nodes": [{"id": "string", "label": "string", "content": "string", "level": 0, "state": "virtual", "source": "string", "reasoning": "string"}],
    "edges": [{"id": "string", "source": "string", "target": "string", "relationship": "string"}]
  }],
  "recommended_drops": []
}

规则：
- 先输出思考分析，再输出 JSON，两者之间空一行
- JSON 部分不要用 ```json``` 代码块包裹
- 所有节点 state 必须是 "virtual"
- 每个 node 必须有 source 和 reasoning 字段：
  - source: 写明信息的具体来源（URL/文章标题/引用），不要只写 [1][2]
  - reasoning: 用 1-2 句话解释这个节点为什么重要，与其他节点如何关联
- 框架标题要精炼有洞察力，不要用"XX框架"、"XX总结"之类的泛称
- 节点层级要有逻辑：level 0 是核心主题，level 1 是支撑维度，level 2+ 是具体论据"#.to_string(),
            refine_prompt: r#"你是一位知识架构伙伴，正在和用户一起优化知识框架。你们像朋友一样讨论，不是审问。

回复模式有两种，根据情况选择：

1. 讨论型（大多数情况）：
   - 用户在分享想法、讨论思路、回答你的观察时
   - 只用自然语言回复，不输出 JSON
   - 给出你的分析和见解
   - 提出具体的、有洞察力的观察（不是提问）
   - 示例："我注意到素材 X 和 Y 之间存在一个有趣的张力..." 而非 "你觉得 X 和 Y 有什么关系？"
   - 如果用户的内容不需要框架变更，就不要输出 JSON

2. 执行型（用户明确要求修改，或你发现框架有明显需要改进的地方）：
   - 先用自然语言说明你的思考和理由
   - 再输出更新后的 JSON 框架
   - 只在确实需要修改框架时才输出 JSON

讨论风格：
- 用伙伴语气，像朋友聊天，不要用"请问"、"您"等敬语
- 给出具体的观察而非泛泛的问题
- 重点关注：素材间的矛盾/互补、框架中的薄弱环节、遗漏的重要维度
- 每次回复控制在 3-5 个要点，不要过于冗长

JSON schema（仅在执行型回复中使用）:
{"frameworks": [{"id", "title", "description", "structure_type", "nodes": [{"id", "label", "content", "level", "state", "source", "reasoning"}], "edges": [{"id", "source", "target", "relationship", "state"}]}], "recommended_drops": []}

规则：
- 自然语言和 JSON 之间空一行
- JSON 不要用代码块包裹
- 保留已有节点的 source 和 reasoning，除非用户明确要求修改
- 关键状态保护规则：
  - state="locked" 的节点必须原样保留，不能修改或删除
  - state="confirmed" 的节点应保留，除非用户明确要求改动
  - 新增节点 state 必须是 "virtual"
  - 保留输入中边的 state 字段
- 新增节点时，与已有的 confirmed/locked 节点建立合理关联"#.to_string(),
        }
    }
}

/// Load prompt configuration from file
fn load_prompt_config() -> Result<PromptConfig> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| AppError::Storage("Cannot find config directory".to_string()))?;
    let config_file = config_dir.join("DropMind").join("prompt_config.json");

    if !config_file.exists() {
        return Ok(PromptConfig::default());
    }

    let content = std::fs::read_to_string(&config_file)
        .map_err(|e| AppError::Storage(format!("Failed to read prompt config: {}", e)))?;

    let config: PromptConfig = serde_json::from_str(&content)
        .unwrap_or_else(|_| PromptConfig::default());

    Ok(config)
}

/// Determine API format based on provider and base_url
fn get_api_format(provider: &str, base_url: Option<&str>) -> &'static str {
    // If base_url contains "anthropic", use Anthropic format
    if let Some(url) = base_url {
        if url.contains("anthropic") {
            return "anthropic";
        }
    }

    // Otherwise check provider
    match provider {
        "claude" => "anthropic",
        _ => "openai",
    }
}

/// Get default base URL for a provider
fn get_default_base_url(provider: &str) -> &'static str {
    match provider {
        "openai" => "https://api.openai.com/v1",
        "claude" => "https://api.anthropic.com/v1",
        "glm" => "https://open.bigmodel.cn/api/paas/v4",
        "minimax" => "https://api.minimax.chat/v1",
        _ => "",
    }
}

/// Extract text content from an SSE data line.
/// Handles both OpenAI and Anthropic streaming formats.
fn extract_sse_text(line: &str, api_format: &str) -> Option<String> {
    let line = line.trim();
    if !line.starts_with("data: ") {
        return None;
    }
    let data = &line[6..];
    if data.trim() == "[DONE]" {
        return None;
    }

    let json: serde_json::Value = serde_json::from_str(data).ok()?;

    match api_format {
        "anthropic" => {
            // Anthropic: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
            if json.get("type").and_then(|t| t.as_str()) == Some("content_block_delta") {
                json.get("delta")?.get("text")?.as_str().map(String::from)
            } else {
                None
            }
        }
        _ => {
            // OpenAI: {"choices":[{"delta":{"content":"..."}}]}
            json.get("choices")?
                .get(0)?
                .get("delta")?
                .get("content")?
                .as_str()
                .map(String::from)
        }
    }
}

/// Streaming OpenAI-compatible API call with SSE event emission.
async fn stream_openai_api(
    client: &Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    app: &tauri::AppHandle,
    request_id: &str,
) -> Result<String> {
    let url = format!("{}/chat/completions", base_url);

    let request = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 32768,
        "stream": true,
    });

    let mut response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Api(format!("API error {}: {}", status, body)));
    }

    let mut full_text = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = response.chunk().await.map_err(|e| AppError::Api(format!("Stream error: {}", e)))? {
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].to_string();
            buffer = buffer[pos + 1..].to_string();

            if let Some(text) = extract_sse_text(&line, "openai") {
                full_text.push_str(&text);
                let _ = app.emit("ai-stream-chunk", serde_json::json!({
                    "chunk": text,
                    "done": false,
                    "requestId": request_id,
                }));
            }
        }
    }

    // Process any remaining buffer
    if let Some(text) = extract_sse_text(&buffer, "openai") {
        full_text.push_str(&text);
        let _ = app.emit("ai-stream-chunk", serde_json::json!({
            "chunk": text,
            "done": false,
            "requestId": request_id,
        }));
    }

    let _ = app.emit("ai-stream-chunk", serde_json::json!({
        "chunk": "",
        "done": true,
        "requestId": request_id,
    }));

    Ok(full_text)
}

/// Streaming Anthropic-compatible API call with SSE event emission.
async fn stream_anthropic_api(
    client: &Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    app: &tauri::AppHandle,
    request_id: &str,
) -> Result<String> {
    let url = format!("{}/messages", base_url);

    let anthropic_messages: Vec<AnthropicMessage> = messages
        .into_iter()
        .map(|m| AnthropicMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let request = serde_json::json!({
        "model": model,
        "messages": anthropic_messages,
        "max_tokens": 32768,
        "stream": true,
    });

    let mut response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .header("x-api-key", api_key)
        .json(&request)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Api(format!("API error {}: {}", status, body)));
    }

    let mut full_text = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = response.chunk().await.map_err(|e| AppError::Api(format!("Stream error: {}", e)))? {
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].to_string();
            buffer = buffer[pos + 1..].to_string();

            if let Some(text) = extract_sse_text(&line, "anthropic") {
                full_text.push_str(&text);
                let _ = app.emit("ai-stream-chunk", serde_json::json!({
                    "chunk": text,
                    "done": false,
                    "requestId": request_id,
                }));
            }
        }
    }

    if let Some(text) = extract_sse_text(&buffer, "anthropic") {
        full_text.push_str(&text);
        let _ = app.emit("ai-stream-chunk", serde_json::json!({
            "chunk": text,
            "done": false,
            "requestId": request_id,
        }));
    }

    let _ = app.emit("ai-stream-chunk", serde_json::json!({
        "chunk": "",
        "done": true,
        "requestId": request_id,
    }));

    Ok(full_text)
}

/// Check if an error is a transient stream/connection error worth retrying.
fn is_transient_error(err: &AppError) -> bool {
    let msg = match err {
        AppError::Api(msg) => msg,
        _ => return false,
    };
    msg.contains("unexpected EOF")
        || msg.contains("Stream error")
        || msg.contains("connection reset")
        || msg.contains("broken pipe")
        || msg.contains("timed out")
}

/// Streaming call_ai that dispatches to the correct provider, with one automatic retry on transient errors.
async fn stream_call_ai(
    app: &tauri::AppHandle,
    provider: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    base_url: Option<&str>,
    request_id: &str,
) -> Result<String> {
    let client = Client::new();
    let base = base_url.unwrap_or_else(|| get_default_base_url(provider));
    let api_format = get_api_format(provider, base_url);

    let result = match api_format {
        "anthropic" => stream_anthropic_api(&client, base, api_key, model, messages.clone(), app, request_id).await,
        _ => stream_openai_api(&client, base, api_key, model, messages.clone(), app, request_id).await,
    };

    match result {
        Ok(text) => Ok(text),
        Err(ref err) if is_transient_error(err) => {
            tracing::warn!("[stream_call_ai] Transient error, retrying once: {:?}", err);
            // Signal frontend to reset streaming state before retry
            let retry_id = format!("{}-retry", request_id);
            let _ = app.emit("ai-stream-chunk", serde_json::json!({
                "chunk": "",
                "done": true,
                "requestId": request_id,
            }));
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            match api_format {
                "anthropic" => stream_anthropic_api(&client, base, api_key, model, messages, app, &retry_id).await,
                _ => stream_openai_api(&client, base, api_key, model, messages, app, &retry_id).await,
            }
        }
        Err(e) => Err(e),
    }
}
#[tauri::command]
pub async fn call_ai(
    provider: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    base_url: Option<String>,
) -> Result<String> {
    let client = Client::new();

    let base = base_url.as_deref()
        .unwrap_or_else(|| get_default_base_url(&provider));

    let api_format = get_api_format(&provider, base_url.as_deref());

    match api_format {
        "anthropic" => call_anthropic_api(&client, base, &api_key, &model, messages).await,
        _ => call_openai_api(&client, base, &api_key, &model, messages).await,
    }
}

/// Call OpenAI-compatible API
async fn call_openai_api(
    client: &Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
) -> Result<String> {
    let url = format!("{}/chat/completions", base_url);

    let request = OpenAIRequest {
        model: model.to_string(),
        messages,
        temperature: 0.7,
        max_tokens: 32768,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Api(format!("API error {}: {}", status, body)));
    }

    let chat_response: OpenAIResponse = response
        .json::<OpenAIResponse>()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Failed to parse response: {}", e)))?;

    chat_response
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .ok_or_else(|| AppError::Api("No response from AI".to_string()))
}

 /// Call Anthropic-compatible API
async fn call_anthropic_api(
    client: &Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
) -> Result<String> {
    let url = format!("{}/messages", base_url);

    tracing::info!("[call_anthropic_api] URL: {}", url);

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01");

    // Use x-api-key header for Anthropic
    req_builder = req_builder.header("x-api-key", api_key);

    // Convert ChatMessage to AnthropicMessage
    let anthropic_messages: Vec<AnthropicMessage> = messages
        .into_iter()
        .map(|m| AnthropicMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let request = AnthropicRequest {
        model: model.to_string(),
        messages: anthropic_messages,
        max_tokens: 32768,
    };

    let response = req_builder
        .json(&request)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Api(format!("API error {}: {}", status, body)));
    }

    let chat_response: AnthropicResponse = response
        .json::<AnthropicResponse>()
        .await
        .map_err(|e: reqwest::Error| AppError::Api(format!("Failed to parse response: {}", e)))?;

    // Extract text from content array
    chat_response
        .content
        .iter()
        .find(|c| c.content_type == "text")
        .and_then(|c| c.text.clone())
        .ok_or_else(|| AppError::Api("No text content in response".to_string()))
}

 /// Test API key by sending a simple request
#[tauri::command]
pub async fn test_api_key(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<String> {
    let test_message = vec![
        ChatMessage {
            role: "user".to_string(),
            content: "Say OK".to_string(),
        },
    ];

    match call_ai(provider, api_key, model, test_message, base_url).await {
        Ok(response) => Ok(format!("连接成功！响应: {}", response)),
        Err(e) => Err(e),
    }
}

 /// Generate frameworks from drops using AI
#[tauri::command]
pub async fn generate_frameworks(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    user_input: String,
    drops: Vec<serde_json::Value>,
) -> Result<serde_json::Value> {
    tracing::info!("[generate_frameworks] Starting with provider: {}, model: {}, base_url: {:?}", provider, model, base_url);

    let drops_text = drops
        .iter()
        .enumerate()
        .map(|(i, d)| format!("[{}] {}", i + 1, d))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt_config = load_prompt_config()?;
    let system_prompt = &prompt_config.framework_prompt;

    tracing::debug!("[generate_frameworks] Using system prompt (first 100 chars): {}", truncate_chars(system_prompt, 100));

    let user_prompt = format!(
        r#"User input: {}

Related materials:
{}

Generate 1 knowledge framework option."#,
        user_input, drops_text
    );

    // Combine system prompt with user prompt for compatibility with APIs that don't support system role
    let combined_prompt = format!("{}\n\n{}", system_prompt, user_prompt);
    let messages = vec![
        ChatMessage { role: "user".to_string(), content: combined_prompt },
    ];

    tracing::info!("[generate_frameworks] Calling AI API with streaming...");

    let request_id = format!("gen-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));

    let response = match stream_call_ai(&app, &provider, &api_key, &model, messages, base_url.as_deref(), &request_id).await {
        Ok(res) => {
            tracing::info!("[generate_frameworks] AI response received, length: {}", res.len());
            res
        }
        Err(e) => {
            tracing::error!("[generate_frameworks] AI call failed: {:?}", e);
            let _ = app.emit("ai-stream-chunk", serde_json::json!({
                "chunk": "",
                "done": true,
                "requestId": request_id,
            }));
            return Err(e);
        }
    };

    // Parse JSON from response
    let content = response.trim();
    tracing::info!("[generate_frameworks] Response content (first 500 chars): {}", truncate_chars(content, 500));

    // Try multiple extraction strategies
    let json_str = extract_json(content);

    tracing::info!("[generate_frameworks] Extracted JSON (first 200 chars): {}", truncate_chars(&json_str, 200));

    // Try parsing directly; if it fails due to truncation, attempt repair
    match serde_json::from_str(&json_str) {
        Ok(val) => Ok(val),
        Err(first_err) => {
            tracing::warn!("[generate_frameworks] Initial parse failed: {}, attempting repair...", first_err);
            let repaired = repair_truncated_json(&json_str);
            if repaired != json_str {
                tracing::info!("[generate_frameworks] Repaired JSON (first 200 chars): {}", truncate_chars(&repaired, 200));
            }
            serde_json::from_str(&repaired)
                .map_err(|e| {
                    tracing::error!("[generate_frameworks] JSON parse error after repair: {}", e);
                    tracing::error!("[generate_frameworks] Original error: {}", first_err);
                    AppError::Api(format!("Failed to parse AI response: {}. The response may have been truncated. Try reducing the number of materials or simplifying your input.", first_err))
                })
        }
    }
}

/// Attempt to repair a truncated JSON string by closing unclosed brackets/braces.
fn repair_truncated_json(json: &str) -> String {
    let mut result = json.to_string();

    // Try to find the last complete element and close from there
    let mut open_brackets: Vec<char> = Vec::new();
    let mut in_string = false;
    let mut escape_next = false;

    for ch in result.chars() {
        if escape_next {
            escape_next = false;
            continue;
        }
        if ch == '\\' && in_string {
            escape_next = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
            continue;
        }
        if in_string {
            continue;
        }
        match ch {
            '{' | '[' => open_brackets.push(ch),
            '}' => {
                if open_brackets.last() == Some(&'{') {
                    open_brackets.pop();
                }
            }
            ']' => {
                if open_brackets.last() == Some(&'[') {
                    open_brackets.pop();
                }
            }
            _ => {}
        }
    }

    // If we're inside a string, close it
    if in_string {
        result.push('"');
    }

    // If we're in the middle of a value (after colon, before comma/bracket),
    // try to truncate to the last valid comma
    if !open_brackets.is_empty() {
        // Try to find the last comma at the current depth and truncate after it
        let repaired = truncate_to_last_complete_element(&result, &open_brackets);
        if let Some(fixed) = repaired {
            result = fixed;
        } else {
            // Fallback: just close all open brackets
            for bracket in open_brackets.iter().rev() {
                match bracket {
                    '{' => result.push('}'),
                    '[' => result.push(']'),
                    _ => {}
                }
            }
        }
    }

    result
}

/// Find the last complete element in a truncated JSON structure and close it properly.
fn truncate_to_last_complete_element(json: &str, open_brackets: &[char]) -> Option<String> {
    // Try progressively shallower depths to find a truncation point
    let base_depth = open_brackets.len();

    for depth_offset in 0..base_depth {
        let target_depth = base_depth - depth_offset;
        let mut depth = 0i32;
        let mut in_string = false;
        let mut escape_next = false;
        let mut last_comma_pos = None;

        for (i, ch) in json.char_indices() {
            if escape_next {
                escape_next = false;
                continue;
            }
            if ch == '\\' && in_string {
                escape_next = true;
                continue;
            }
            if ch == '"' {
                in_string = !in_string;
                continue;
            }
            if in_string {
                continue;
            }
            match ch {
                '{' | '[' => depth += 1,
                '}' | ']' => depth -= 1,
                ',' => {
                    if depth as usize == target_depth {
                        last_comma_pos = Some(i);
                    }
                }
                _ => {}
            }
        }

        if let Some(pos) = last_comma_pos {
            let mut truncated = json[..pos].to_string();
            // Close brackets from the depth we found the comma, plus any deeper ones
            let brackets_to_close = depth_offset + 1;
            for bracket in open_brackets.iter().rev().take(brackets_to_close) {
                match bracket {
                    '{' => truncated.push('}'),
                    '[' => truncated.push(']'),
                    _ => {}
                }
            }
            return Some(truncated);
        }
    }

    None
}

 /// Extract JSON from AI response using multiple strategies
fn extract_json(content: &str) -> String {
    // Strategy 1: Extract from ```json code block
    if content.contains("```json") {
        if let Some(json) = content.split("```json").nth(1)
            .and_then(|s| s.split("```").next())
            .map(|s| s.trim().to_string())
        {
            tracing::debug!("[extract_json] Found ```json block");
            return json;
        }
    }

    // Strategy 2: Extract from ``` code block
    if content.contains("```") {
        if let Some(json) = content.split("```").nth(1)
            .and_then(|s| s.split("```").next())
            .map(|s| s.trim().to_string())
        {
            // Check if it looks like JSON
            if json.starts_with('{') || json.starts_with('[') {
                tracing::debug!("[extract_json] Found ``` block with JSON");
                return json;
            }
        }
    }

    // Strategy 3: Find JSON object by looking for { ... } with string awareness
    if let Some(start) = content.find('{') {
        // Find matching closing brace, tracking string context to ignore braces inside strings
        let mut depth = 0;
        let mut end = start;
        let mut in_string = false;
        let mut escape_next = false;
        for (byte_idx, c) in content[start..].char_indices() {
            if escape_next {
                escape_next = false;
                continue;
            }
            if c == '\\' && in_string {
                escape_next = true;
                continue;
            }
            if c == '"' {
                in_string = !in_string;
                continue;
            }
            if in_string {
                continue;
            }
            match c {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        end = start + byte_idx + c.len_utf8();
                        break;
                    }
                }
                _ => {}
            }
        }
        if end > start {
            let json = content[start..end].to_string();
            tracing::debug!("[extract_json] Extracted JSON object from position {} to {}", start, end);
            return json;
        }
    }

    // Strategy 4: Try to parse markdown and construct JSON
    if content.contains("###") || content.contains("##") || content.contains("Option") {
        tracing::info!("[extract_json] Attempting markdown fallback parsing");
        if let Some(json) = parse_markdown_to_json(content) {
            tracing::info!("[extract_json] Successfully parsed markdown to JSON");
            return json;
        }
    }

    // Strategy 5: Return as-is and let JSON parser handle the error
    tracing::warn!("[extract_json] No JSON structure found, returning original content");
    content.to_string()
}

 /// Parse markdown-formatted framework response to JSON
fn parse_markdown_to_json(content: &str) -> Option<String> {
    use std::collections::HashMap;

    let mut frameworks: Vec<HashMap<String, serde_json::Value>> = Vec::new();
    let mut current_framework: Option<HashMap<String, serde_json::Value>> = None;
    let mut current_nodes: Vec<serde_json::Value> = Vec::new();
    let mut current_description = String::new();
    let mut current_title = String::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Detect framework headers (### Option N or ## Framework N)
        if trimmed.starts_with("### Option") || trimmed.starts_with("## Option") ||
           trimmed.starts_with("### Framework") || trimmed.starts_with("## Framework") {
            // Save previous framework if exists
            if let Some(mut fw) = current_framework.take() {
                if !current_nodes.is_empty() {
                    fw.insert("nodes".to_string(), serde_json::to_value(&current_nodes).unwrap());
                }
                fw.insert("description".to_string(), serde_json::to_value(current_description.trim()).unwrap());
                frameworks.push(fw);
            }

            // Start new framework
            current_title = trimmed
                .trim_start_matches('#')
                .trim()
                .trim_start_matches(|c: char| c.is_numeric() || c == '.' || c == ':' || c == ' ')
                .to_string();
            current_description = String::new();
            current_nodes = Vec::new();

            let mut fw = HashMap::new();
            fw.insert("id".to_string(), serde_json::to_value(format!("framework-{}", frameworks.len() + 1)).unwrap());
            fw.insert("title".to_string(), serde_json::to_value(&current_title).unwrap());
            fw.insert("structure_type".to_string(), serde_json::json!("custom"));
            current_framework = Some(fw);
        }
        // Detect node headers (**Node** or - Node or ### Node)
        else if trimmed.starts_with("**") || trimmed.starts_with("- ") ||
                (trimmed.starts_with("###") && !trimmed.starts_with("### Option") && !trimmed.starts_with("### Framework")) {
            if current_framework.is_some() {
                let node_label = trimmed
                    .trim_start_matches('*')
                    .trim_start_matches('-')
                    .trim_start_matches('#')
                    .trim()
                    .trim_end_matches(':')
                    .trim_end_matches('*')
                    .to_string();

                if !node_label.is_empty() && node_label.len() > 1 {
                    let node_id = format!("node-{}-{}", frameworks.len(), current_nodes.len());
                    current_nodes.push(serde_json::json!({
                        "id": node_id,
                        "label": node_label,
                        "content": node_label,
                        "level": 0,
                        "state": "virtual"
                    }));
                }
            }
        }
        // Collect description text
        else if !trimmed.is_empty() && current_framework.is_some() && !trimmed.starts_with('#') {
            if current_description.is_empty() {
                current_description = trimmed.to_string();
            } else if current_description.len() < 500 {
                current_description.push(' ');
                current_description.push_str(trimmed);
            }
        }
    }

    // Save last framework
    if let Some(mut fw) = current_framework {
        if !current_nodes.is_empty() {
            fw.insert("nodes".to_string(), serde_json::to_value(&current_nodes).unwrap());
        } else {
            // Create default node if none found
            fw.insert("nodes".to_string(), serde_json::json!([{
                "id": "node-1",
                "label": current_title.clone(),
                "content": current_title,
                "level": 0,
                "state": "virtual"
            }]));
        }
        fw.insert("description".to_string(), serde_json::to_value(current_description.trim()).unwrap());
        frameworks.push(fw);
    }

    if frameworks.is_empty() {
        return None;
    }

    // Build final JSON
    let result = serde_json::json!({
        "frameworks": frameworks,
        "recommended_drops": []
    });

    serde_json::to_string(&result).ok()
}
 /// Refine a framework based on user instruction
#[tauri::command]
pub async fn refine_framework(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    framework: serde_json::Value,
    instruction: String,
) -> Result<serde_json::Value> {
    let prompt_config = load_prompt_config()?;
    let system_prompt = &prompt_config.refine_prompt;

    let user_prompt = format!(
        r#"Current framework:
{}

User instruction: {}

Return the updated framework."#,
        serde_json::to_string_pretty(&framework).unwrap_or_default(),
        instruction
    );

    // Combine system prompt with user prompt for compatibility with APIs that don't support system role
    let combined_prompt = format!("{}\n\n{}", system_prompt, user_prompt);
    let messages = vec![
        ChatMessage { role: "user".to_string(), content: combined_prompt },
    ];

    let request_id = format!("ref-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));

    let response = match stream_call_ai(&app, &provider, &api_key, &model, messages, base_url.as_deref(), &request_id).await {
        Ok(res) => res,
        Err(e) => {
            let _ = app.emit("ai-stream-chunk", serde_json::json!({
                "chunk": "",
                "done": true,
                "requestId": request_id,
            }));
            return Err(e);
        }
    };

    let content = response.trim();
    let json_str = extract_json(content);

    tracing::info!("[refine_framework] Extracted JSON (first 500 chars): {}", truncate_chars(&json_str, 500));

    match serde_json::from_str(&json_str) {
        Ok(val) => Ok(val),
        Err(first_err) => {
            tracing::warn!("[refine_framework] Initial parse failed: {}, attempting repair...", first_err);
            let repaired = repair_truncated_json(&json_str);
            match serde_json::from_str(&repaired) {
                Ok(val) => Ok(val),
                Err(e) => {
                    // Discussion-type response: AI chose to reply with natural language only (no JSON)
                    // This is valid per the refine_prompt — return empty frameworks with raw_text
                    tracing::info!("[refine_framework] No JSON found (parse errors: {} / {}), treating as discussion-type response", first_err, e);
                    Ok(serde_json::json!({
                        "frameworks": [],
                        "recommended_drops": [],
                        "raw_text": content
                    }))
                }
            }
        }
    }
}

/// Generate contextual guidance questions based on the current framework and drops.
#[tauri::command]
pub async fn generate_guidance_questions(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    framework_json: String,
    drops_json: String,
    question_type: String,
) -> Result<Vec<String>> {
    let _prompt_config = load_prompt_config();
    let is_followup = question_type == "followup";

    let framework_desc = if framework_json.is_empty() {
        "（尚未生成框架）".to_string()
    } else {
        format!("当前框架：{}", framework_json)
    };

    let drops_desc = if drops_json.is_empty() {
        "（无素材）".to_string()
    } else {
        format!("相关素材：{}", drops_json)
    };

    let question_instruction = if is_followup {
        "用户已经回答了第一轮引导问题，请基于他们的回答和当前框架状态，生成 3 个更深入的跟进问题。重点关注：框架中未覆盖的素材要点、节点间关系的合理性、是否有遗漏或矛盾的维度。"
    } else {
        "请生成 3 个有针对性的引导问题，帮助用户：深入思考素材中的核心观点和隐含逻辑、评估框架结构是否合理、发现可能遗漏的重要维度或关联。"
    };

    let messages = vec![
        ChatMessage {
            role: "user".to_string(),
            content: format!(
                "你是一位知识架构伙伴。用户正在构建一个知识框架，你需要帮助引导用户深入思考。\n\n\
                {framework_desc}\n\n\
                {drops_desc}\n\n\
                {question_instruction}\n\n\
                要求：\n\
                - 问题要具体、个性化，基于素材内容提问\n\
                - 不要问泛泛的问题（如\"你觉得怎么样\"）\n\
                - 用伙伴语气，像是朋友在讨论，不是审问\n\
                - 每个问题聚焦一个维度\n\
                - 直接输出问题列表，每行一个，不要编号，不要多余解释"
            ),
        },
    ];

    let response = call_ai(provider, api_key, model, messages, base_url).await?;

    let questions: Vec<String> = response
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(questions)
}

/// Summarize a conversation and framework into a concise summary.
#[tauri::command]
pub async fn summarize_conversation(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    messages: Vec<ChatMessage>,
    framework_summary: String,
) -> Result<String> {
    let system_prompt = "You are a knowledge management assistant. Your task has two parts:

1. First, generate a SHORT TITLE (max 20 characters) for this knowledge framework. The title should capture the core theme or insight — do NOT use words like \"摘要\", \"总结\", \"框架\", \"复盘\" etc. Just describe the essence directly. Use the same language as the conversation.

2. Then, provide a concise summary (2-3 sentences) covering: what was discussed, key decisions made, and the final outcome.

Format your response exactly like this:
TITLE: <your title here>
---
<your summary here>

Example:
TITLE: 从碎片信息到系统认知
---
用户通过三篇素材整理了关于...";

    let user_prompt = format!(
        "Framework summary:\n{}\n\nConversation:\n{}\n\nProvide the title and summary as instructed.",
        framework_summary,
        messages.iter()
            .map(|m| format!("{}: {}", m.role, m.content))
            .collect::<Vec<_>>()
            .join("\n")
    );

    let combined = format!("{}\n\n{}", system_prompt, user_prompt);
    let chat_messages = vec![
        ChatMessage { role: "user".to_string(), content: combined },
    ];

    let response = match call_ai(provider, api_key, model, chat_messages, base_url).await {
        Ok(res) => res,
        Err(e) => {
            tracing::warn!("Summary generation failed: {:?}", e);
            return Ok("无法生成总结".to_string());
        }
    };

    Ok(response)
}

