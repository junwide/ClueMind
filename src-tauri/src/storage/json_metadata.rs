use crate::error::{AppError, Result};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

pub struct JsonMetadataStorage {
    base_path: PathBuf,
}

impl JsonMetadataStorage {
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
    }

    pub fn save<T: Serialize>(&self, filename: &str, data: &T) -> Result<()> {
        let path = self.base_path.join(filename);
        let content = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Serialization(format!("Failed to serialize: {}", e)))?;

        fs::write(&path, content)
            .map_err(|e| AppError::Storage(format!("Failed to save {}: {}", filename, e)))?;
        Ok(())
    }

    pub fn load<T: DeserializeOwned>(&self, filename: &str) -> Result<T> {
        let path = self.base_path.join(filename);
        let content = fs::read_to_string(&path)
            .map_err(|e| AppError::Storage(format!("Failed to load {}: {}", filename, e)))?;

        let data = serde_json::from_str(&content)
            .map_err(|e| AppError::Serialization(format!("Failed to deserialize: {}", e)))?;
        Ok(data)
    }

    pub fn delete(&self, filename: &str) -> Result<()> {
        let path = self.base_path.join(filename);
        fs::remove_file(&path)
            .map_err(|e| AppError::Storage(format!("Failed to delete {}: {}", filename, e)))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use tempfile::TempDir;

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        count: u32,
    }

    #[test]
    fn test_save_and_load_json() {
        let temp_dir = TempDir::new().unwrap();
        let storage = JsonMetadataStorage::new(temp_dir.path().to_path_buf());

        let data = TestData {
            name: "test".to_string(),
            count: 42,
        };

        storage.save("test.json", &data).unwrap();
        let loaded: TestData = storage.load("test.json").unwrap();

        assert_eq!(data, loaded);
    }

    #[test]
    fn test_delete_json() {
        let temp_dir = TempDir::new().unwrap();
        let storage = JsonMetadataStorage::new(temp_dir.path().to_path_buf());

        let data = TestData {
            name: "test".to_string(),
            count: 42,
        };

        storage.save("test.json", &data).unwrap();
        assert!(storage.load::<TestData>("test.json").is_ok());

        storage.delete("test.json").unwrap();
        assert!(storage.load::<TestData>("test.json").is_err());
    }

    #[test]
    fn test_json_format() {
        let temp_dir = TempDir::new().unwrap();
        let storage = JsonMetadataStorage::new(temp_dir.path().to_path_buf());

        let data = TestData {
            name: "test".to_string(),
            count: 42,
        };

        storage.save("test.json", &data).unwrap();

        // Verify it's formatted with pretty print
        let raw_content = std::fs::read_to_string(temp_dir.path().join("test.json")).unwrap();
        assert!(raw_content.contains("\n")); // Pretty print has newlines
        assert!(raw_content.contains("\"name\""));
        assert!(raw_content.contains("\"count\""));
    }
}
