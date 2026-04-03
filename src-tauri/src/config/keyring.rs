use crate::error::{AppError, Result};
use keyring::Entry;

pub struct KeyringManager {
    service_name: String,
}

impl KeyringManager {
    pub fn new() -> Self {
        Self {
            service_name: "ClueMind".to_string(),
        }
    }

    fn with_service_name(name: &str) -> Self {
        Self {
            service_name: name.to_string(),
        }
    }

    pub fn save_api_key(&self, provider: &str, key: &str) -> Result<()> {
        let entry = Entry::new(&self.service_name, provider)
            .map_err(|e| AppError::Keyring(format!("Failed to create entry: {}", e)))?;

        entry.set_password(key)
            .map_err(|e| AppError::Keyring(format!("Failed to save key: {}", e)))?;

        Ok(())
    }

    pub fn get_api_key(&self, provider: &str) -> Result<String> {
        let entry = Entry::new(&self.service_name, provider)
            .map_err(|e| AppError::Keyring(format!("Failed to create entry: {}", e)))?;

        let key = entry.get_password()
            .map_err(|e| AppError::Keyring(format!("Failed to get key: {}", e)))?;

        Ok(key)
    }

    pub fn delete_api_key(&self, provider: &str) -> Result<()> {
        let entry = Entry::new(&self.service_name, provider)
            .map_err(|e| AppError::Keyring(format!("Failed to create entry: {}", e)))?;

        entry.delete_password()
            .map_err(|e| AppError::Keyring(format!("Failed to delete key: {}", e)))?;

        Ok(())
    }

    /// Migrate API keys from old service name "ReviewYourMind" to "ClueMind".
    /// Safe to call multiple times — skips providers already migrated.
    pub fn migrate_from_old_service() {
        let old = Self::with_service_name("ReviewYourMind");
        let new = Self::new();
        let providers = ["openai", "claude", "glm", "minimax"];

        for provider in providers {
            if let Ok(key) = old.get_api_key(provider) {
                if new.save_api_key(provider, &key).is_ok() {
                    tracing::info!("Migrated keyring entry for provider: {}", provider);
                    let _ = old.delete_api_key(provider);
                }
            }
        }
    }
}

impl Default for KeyringManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires real system keyring, skip in CI
    fn test_save_and_get_api_key() {
        let manager = KeyringManager::new();

        manager.save_api_key("test_provider", "test_key").unwrap();
        let key = manager.get_api_key("test_provider").unwrap();

        assert_eq!(key, "test_key");

        manager.delete_api_key("test_provider").unwrap();
    }
}
