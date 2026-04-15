use crate::error::{AppError, Result};
use crate::models::{AppConfig, LLMConfig, LLMProvider, UIConfig, StorageConfig, LoggingConfig, SyncConfig};
use std::fs;
use std::path::PathBuf;

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(base_path: PathBuf) -> Self {
        Self {
            config_path: base_path.join("config.toml"),
        }
    }

    pub fn load(&self) -> Result<AppConfig> {
        if !self.config_path.exists() {
            return Ok(AppConfig::default());
        }

        let content = fs::read_to_string(&self.config_path)
            .map_err(|e| AppError::Config(format!("Failed to read config: {}", e)))?;

        let config: AppConfig = toml::from_str(&content)
            .map_err(|e| AppError::Config(format!("Failed to parse config: {}", e)))?;

        Ok(config)
    }

    pub fn save(&self, config: &AppConfig) -> Result<()> {
        let content = toml::to_string_pretty(config)
            .map_err(|e| AppError::Config(format!("Failed to serialize config: {}", e)))?;

        fs::write(&self.config_path, content)
            .map_err(|e| AppError::Config(format!("Failed to write config: {}", e)))?;

        Ok(())
    }
}

#[allow(clippy::derivable_impls)]
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llm: LLMConfig::default(),
            ui: UIConfig::default(),
            storage: StorageConfig::default(),
            shortcuts: std::collections::HashMap::new(),
            logging: LoggingConfig::default(),
            sync: SyncConfig::default(),
        }
    }
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            default_provider: LLMProvider::GLM,
            providers: std::collections::HashMap::new(),
        }
    }
}

impl Default for UIConfig {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            font_size: 14,
        }
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("ClueMind");

        Self {
            data_dir: data_dir.to_string_lossy().to_string(),
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file_path: "~/.cluemind/logs/app.log".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ProviderConfig;
    use tempfile::TempDir;

    #[test]
    fn test_load_default_config() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = manager.load().unwrap();

        assert_eq!(config.ui.theme, "light");
        assert_eq!(config.logging.level, "info");
    }

    #[test]
    fn test_save_and_load_config() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let mut config = AppConfig::default();
        config.ui.theme = "dark".to_string();

        manager.save(&config).unwrap();
        let loaded = manager.load().unwrap();

        assert_eq!(loaded.ui.theme, "dark");
    }

    #[test]
    fn test_default_config_values() {
        let config = AppConfig::default();

        assert_eq!(config.ui.theme, "light");
        assert_eq!(config.ui.font_size, 14);
        assert_eq!(config.logging.level, "info");
        assert!(config.shortcuts.is_empty());
        assert!(config.llm.providers.is_empty());
    }

    #[test]
    fn test_default_llm_config() {
        let llm = LLMConfig::default();
        assert_eq!(llm.default_provider, LLMProvider::GLM);
        assert!(llm.providers.is_empty());
    }

    #[test]
    fn test_default_ui_config() {
        let ui = UIConfig::default();
        assert_eq!(ui.theme, "light");
        assert_eq!(ui.font_size, 14);
    }

    #[test]
    fn test_default_logging_config() {
        let logging = LoggingConfig::default();
        assert_eq!(logging.level, "info");
        assert!(!logging.file_path.is_empty());
    }

    #[test]
    fn test_config_with_shortcuts() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let mut config = AppConfig::default();
        config.shortcuts.insert("quick_drop".to_string(), "Ctrl+Shift+D".to_string());
        config.shortcuts.insert("new_note".to_string(), "Ctrl+N".to_string());

        manager.save(&config).unwrap();
        let loaded = manager.load().unwrap();

        assert_eq!(loaded.shortcuts.len(), 2);
        assert_eq!(loaded.shortcuts.get("quick_drop").unwrap(), "Ctrl+Shift+D");
        assert_eq!(loaded.shortcuts.get("new_note").unwrap(), "Ctrl+N");
    }

    #[test]
    fn test_config_with_llm_providers() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let mut config = AppConfig::default();
        config.llm.default_provider = LLMProvider::OpenAI;
        config.llm.providers.insert(
            LLMProvider::OpenAI,
            ProviderConfig {
                api_key_ref: "openai_key".to_string(),
                model: "gpt-4".to_string(),
                base_url: None,
                temperature: 0.7,
                max_tokens: 4096,
            },
        );
        config.llm.providers.insert(
            LLMProvider::Claude,
            ProviderConfig {
                api_key_ref: "claude_key".to_string(),
                model: "claude-3".to_string(),
                base_url: Some("https://api.anthropic.com".to_string()),
                temperature: 0.5,
                max_tokens: 8192,
            },
        );

        manager.save(&config).unwrap();
        let loaded = manager.load().unwrap();

        assert_eq!(loaded.llm.default_provider, LLMProvider::OpenAI);
        assert_eq!(loaded.llm.providers.len(), 2);

        let openai = loaded.llm.providers.get(&LLMProvider::OpenAI).unwrap();
        assert_eq!(openai.model, "gpt-4");
        assert!(openai.base_url.is_none());

        let claude = loaded.llm.providers.get(&LLMProvider::Claude).unwrap();
        assert_eq!(claude.model, "claude-3");
        assert_eq!(claude.base_url.as_deref(), Some("https://api.anthropic.com"));
        assert!((claude.temperature - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_config_toml_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let mut config = AppConfig::default();
        config.ui.theme = "dark".to_string();
        config.ui.font_size = 18;
        config.logging.level = "debug".to_string();
        config.shortcuts.insert("test".to_string(), "Ctrl+T".to_string());

        manager.save(&config).unwrap();
        let loaded = manager.load().unwrap();

        assert_eq!(loaded.ui.theme, config.ui.theme);
        assert_eq!(loaded.ui.font_size, config.ui.font_size);
        assert_eq!(loaded.logging.level, config.logging.level);
        assert_eq!(loaded.shortcuts, config.shortcuts);
    }

    #[test]
    fn test_load_config_from_nonexistent_path() {
        let temp_dir = TempDir::new().unwrap();
        // Use a subdirectory that doesn't have a config file
        let manager = ConfigManager::new(temp_dir.path().join("nonexistent").to_path_buf());

        // Should return default config without error
        let config = manager.load().unwrap();
        assert_eq!(config.ui.theme, "light");
    }
}
