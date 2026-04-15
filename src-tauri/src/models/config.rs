use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub llm: LLMConfig,
    pub ui: UIConfig,
    pub storage: StorageConfig,
    pub shortcuts: HashMap<String, String>,
    pub logging: LoggingConfig,
    #[serde(default)]
    pub sync: SyncConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub default_provider: LLMProvider,
    pub providers: HashMap<LLMProvider, ProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key_ref: String,
    pub model: String,
    pub base_url: Option<String>,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub theme: String,
    pub font_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub data_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_path: String,
}

fn default_sync_interval() -> u64 { 30 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    #[serde(default)]
    pub server_url: Option<String>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_sync_interval")]
    pub auto_sync_interval_minutes: u64,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            server_url: None,
            enabled: false,
            auto_sync_interval_minutes: default_sync_interval(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum LLMProvider {
    GLM,
    Qwen,
    OpenAI,
    Claude,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_creation() {
        let mut providers = HashMap::new();
        providers.insert(
            LLMProvider::GLM,
            ProviderConfig {
                api_key_ref: "glm_api_key".to_string(),
                model: "glm-4".to_string(),
                base_url: None,
                temperature: 0.7,
                max_tokens: 4096,
            },
        );

        let config = AppConfig {
            llm: LLMConfig {
                default_provider: LLMProvider::GLM,
                providers,
            },
            ui: UIConfig {
                theme: "dark".to_string(),
                font_size: 14,
            },
            storage: StorageConfig {
                data_dir: "/tmp/dropmind".to_string(),
            },
            shortcuts: HashMap::new(),
            logging: LoggingConfig {
                level: "info".to_string(),
                file_path: "/tmp/dropmind.log".to_string(),
            },
            sync: SyncConfig::default(),
        };

        assert_eq!(config.llm.default_provider, LLMProvider::GLM);
        assert_eq!(config.ui.theme, "dark");
        assert_eq!(config.ui.font_size, 14);
    }

    #[test]
    fn test_llm_provider_equality() {
        assert_eq!(LLMProvider::GLM, LLMProvider::GLM);
        assert_ne!(LLMProvider::GLM, LLMProvider::OpenAI);
    }

    #[test]
    fn test_provider_config_serialization() {
        let config = ProviderConfig {
            api_key_ref: "test_key".to_string(),
            model: "test-model".to_string(),
            base_url: None,
            temperature: 0.5,
            max_tokens: 2048,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test_key"));
        assert!(json.contains("test-model"));
    }

    #[test]
    fn test_app_config_serialization() {
        let config = AppConfig {
            llm: LLMConfig {
                default_provider: LLMProvider::Claude,
                providers: HashMap::new(),
            },
            ui: UIConfig {
                theme: "light".to_string(),
                font_size: 16,
            },
            storage: StorageConfig {
                data_dir: "/data".to_string(),
            },
            shortcuts: HashMap::new(),
            logging: LoggingConfig {
                level: "debug".to_string(),
                file_path: "/app.log".to_string(),
            },
            sync: SyncConfig::default(),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("Claude"));
        assert!(json.contains("light"));
    }

    #[test]
    fn test_sync_config_default() {
        let config = SyncConfig::default();
        assert!(config.server_url.is_none());
        assert!(!config.enabled);
        assert_eq!(config.auto_sync_interval_minutes, 30);
    }

    #[test]
    fn test_sync_config_serialization() {
        let config = SyncConfig {
            server_url: Some("http://localhost:3817".to_string()),
            enabled: true,
            auto_sync_interval_minutes: 15,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("localhost"));
        let parsed: SyncConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.server_url, Some("http://localhost:3817".to_string()));
        assert!(parsed.enabled);
        assert_eq!(parsed.auto_sync_interval_minutes, 15);
    }
}
