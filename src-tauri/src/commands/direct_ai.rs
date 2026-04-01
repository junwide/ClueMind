// src-tauri/src/commands/direct_ai.rs
//! Direct AI commands that call LLM APIs without requiring a sidecar process.
use reqwest::Client;
use serde::{Deserialize, Serialize};
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
            framework_prompt: r#"You are a knowledge organization expert.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, just the raw JSON object.

Generate exactly 1 knowledge framework option based on the user's input.

JSON schema to return:
{
  "frameworks": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "structure_type": "pyramid" | "pillars" | "custom",
      "nodes": [{"id": "string", "label": "string", "content": "string", "level": 0, "state": "virtual", "source": "string", "reasoning": "string"}],
      "edges": [{"id": "string", "source": "string", "target": "string", "relationship": "string"}]
    }
  ],
  "recommended_drops": []
}

Rules:
- Return ONLY the JSON object, nothing else
- Do not use ```json``` code blocks
- Do not add any text before or after the JSON
- All node states must be "virtual"
- Each node MUST have "source" and "reasoning" fields with the following requirements:
  - "source": Write the SPECIFIC origin of the information, NOT just material numbers like [1][2]. If the material contains a URL, include the full URL. If it references an article or book, include the title and author. If it is a viewpoint from a material, write "From material [N]: <key quote or fact>". Always provide concrete, traceable provenance.
  - "reasoning": Provide a DETAILED reasoning process of at least 2-3 sentences. Explain: (1) the logical basis for this node, (2) why it is important to the framework, (3) how it connects logically to other nodes, and (4) what factors were considered during derivation. Do NOT write brief one-liner summaries."#.to_string(),
            refine_prompt: r#"You are a knowledge organization expert.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, just the raw JSON object.

Modify the given framework based on the user's instruction.

Return the updated framework as JSON with the same structure:
{"frameworks": [{"id", "title", "description", "structure_type", "nodes": [{"id", "label", "content", "level", "state", "source", "reasoning"}], "edges": [{"id", "source", "target", "relationship", "state"}]}], "recommended_drops": []}

The frameworks array should contain exactly one framework.

Rules:
- Return ONLY the JSON object, nothing else
- Do not use ```json``` code blocks
- Do not add any text before or after the JSON
- Each node MUST have "source" and "reasoning" fields with the following requirements:
  - "source": Write the SPECIFIC origin of the information, NOT just material numbers like [1][2]. If the material contains a URL, include the full URL. If it references an article or book, include the title and author. If it is a viewpoint from a material, write "From material [N]: <key quote or fact>". Always provide concrete, traceable provenance.
  - "reasoning": Provide a DETAILED reasoning process of at least 2-3 sentences. Explain: (1) the logical basis for this node, (2) why it is important to the framework, (3) how it connects logically to other nodes, and (4) what factors were considered during derivation. Do NOT write brief one-liner summaries.
- Preserve source and reasoning from existing nodes unless the user explicitly asks to change them
- CRITICAL - Respect node and edge states:
  - Nodes with state "locked" MUST be preserved exactly as-is. Do NOT modify their content, label, or remove them.
  - Nodes with state "confirmed" should be preserved unless the user explicitly requests changes to them.
  - Edges with state "locked" MUST be preserved. Do NOT remove or modify them.
  - Edges with state "confirmed" should be preserved unless contradicted by new information.
  - When adding new nodes from new materials, create connections (edges) to existing confirmed/locked nodes where logically relevant.
  - All new nodes should have state "virtual". All new edges should have state "virtual".
  - Return edges with their "state" field preserved from the input."#.to_string(),
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

/// Call AI API (supports both OpenAI and Anthropic formats)
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
        max_tokens: 16384,
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
        .map(|c| c.message.content.clone())
        .flatten()
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
        max_tokens: 16384,
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

    tracing::info!("[generate_frameworks] Calling AI API...");

    let response = match call_ai(provider, api_key, model, messages, base_url).await {
        Ok(res) => {
            tracing::info!("[generate_frameworks] AI response received, length: {}", res.len());
            res
        }
        Err(e) => {
            tracing::error!("[generate_frameworks] AI call failed: {:?}", e);
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
    // Find the last comma that's at the correct nesting depth
    let target_depth = open_brackets.len();
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
        // Close all open brackets in reverse order
        for bracket in open_brackets.iter().rev() {
            match bracket {
                '{' => truncated.push('}'),
                '[' => truncated.push(']'),
                _ => {}
            }
        }
        Some(truncated)
    } else {
        None
    }
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

    let response = call_ai(provider, api_key, model, messages, base_url).await?;

    let content = response.trim();
    let json_str = extract_json(content);

    tracing::info!("[refine_framework] Extracted JSON (first 500 chars): {}", truncate_chars(&json_str, 500));

    match serde_json::from_str(&json_str) {
        Ok(val) => Ok(val),
        Err(first_err) => {
            tracing::warn!("[refine_framework] Initial parse failed: {}, attempting repair...", first_err);
            let repaired = repair_truncated_json(&json_str);
            serde_json::from_str(&repaired)
                .map_err(|e| AppError::Api(format!("Failed to parse AI response: {} (original: {}). The response may have been truncated.", e, first_err)))
        }
    }
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

