use crate::error::{AppError, Result};
use std::fs;
use std::path::PathBuf;

pub struct MarkdownStorage {
    base_path: PathBuf,
}

impl MarkdownStorage {
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
    }

    pub fn save(&self, filename: &str, content: &str) -> Result<()> {
        let path = self.base_path.join(filename);
        fs::write(&path, content)
            .map_err(|e| AppError::Storage(format!("Failed to save {}: {}", filename, e)))?;
        Ok(())
    }

    pub fn load(&self, filename: &str) -> Result<String> {
        let path = self.base_path.join(filename);
        let content = fs::read_to_string(&path)
            .map_err(|e| AppError::Storage(format!("Failed to load {}: {}", filename, e)))?;
        Ok(content)
    }

    pub fn delete(&self, filename: &str) -> Result<()> {
        let path = self.base_path.join(filename);
        fs::remove_file(&path)
            .map_err(|e| AppError::Storage(format!("Failed to delete {}: {}", filename, e)))?;
        Ok(())
    }

    pub fn list(&self) -> Result<Vec<String>> {
        let mut files = Vec::new();
        for entry in fs::read_dir(&self.base_path)
            .map_err(|e| AppError::Storage(format!("Failed to list directory: {}", e)))?
        {
            let entry = entry.map_err(|e| AppError::Storage(format!("Failed to read entry: {}", e)))?;
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".md") {
                    files.push(name.to_string());
                }
            }
        }
        Ok(files)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load_markdown() {
        let temp_dir = TempDir::new().unwrap();
        let storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

        let content = "# Test Framework\n\nThis is a test.";
        let filename = "test.md";

        storage.save(filename, content).unwrap();
        let loaded = storage.load(filename).unwrap();

        assert_eq!(content, loaded);
    }

    #[test]
    fn test_delete_markdown() {
        let temp_dir = TempDir::new().unwrap();
        let storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

        let content = "# Test";
        let filename = "test.md";

        storage.save(filename, content).unwrap();
        assert!(storage.load(filename).is_ok());

        storage.delete(filename).unwrap();
        assert!(storage.load(filename).is_err());
    }

    #[test]
    fn test_list_markdown_files() {
        let temp_dir = TempDir::new().unwrap();
        let storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

        storage.save("file1.md", "content1").unwrap();
        storage.save("file2.md", "content2").unwrap();
        storage.save("file3.txt", "text content").unwrap();

        let files = storage.list().unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"file1.md".to_string()));
        assert!(files.contains(&"file2.md".to_string()));
    }
}
