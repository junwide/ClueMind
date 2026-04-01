use crate::error::{AppError, Result};
use crate::models::{AppConfig, LLMConfig, LLMProvider, UIConfig, StorageConfig, LoggingConfig};
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
            .join("ReviewYourMind");

        Self {
            data_dir: data_dir.to_string_lossy().to_string(),
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file_path: "~/.reviewyourmind/logs/app.log".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
}
