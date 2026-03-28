//! Integration tests for config and storage modules
//!
//! This test module verifies that the ConfigManager and MarkdownStorage
//! modules work correctly together in an integrated environment.

use reviewyourmind::{ConfigManager, MarkdownStorage};
use tempfile::TempDir;

/// Tests the integration between ConfigManager and MarkdownStorage.
///
/// This test:
/// 1. Creates a temporary directory for isolated testing
/// 2. Tests ConfigManager - load default, modify, save, and reload
/// 3. Tests MarkdownStorage - save, load, and verify content
#[test]
fn test_config_and_storage_integration() {
    let temp_dir = TempDir::new().unwrap();

    // Test ConfigManager
    let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());

    // Load default config
    let mut config = config_manager.load().unwrap();
    assert_eq!(config.ui.theme, "light");

    // Modify and save config
    config.ui.theme = "dark".to_string();
    config.ui.font_size = 16;
    config_manager.save(&config).unwrap();

    // Reload and verify changes persisted
    let loaded_config = config_manager.load().unwrap();
    assert_eq!(loaded_config.ui.theme, "dark");
    assert_eq!(loaded_config.ui.font_size, 16);

    // Test MarkdownStorage
    let md_storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

    // Save markdown content
    let test_content = "# Test Framework\n\nThis is a test markdown file.";
    md_storage.save("test.md", test_content).unwrap();

    // Load and verify content
    let content = md_storage.load("test.md").unwrap();
    assert_eq!(content, test_content);

    // Verify file appears in list
    let files = md_storage.list().unwrap();
    assert!(files.contains(&"test.md".to_string()));
}

/// Tests that multiple config saves and loads work correctly.
#[test]
fn test_config_multiple_saves() {
    let temp_dir = TempDir::new().unwrap();
    let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());

    // First save
    let mut config = config_manager.load().unwrap();
    config.ui.theme = "dark".to_string();
    config_manager.save(&config).unwrap();

    // Second save with different values
    let mut config = config_manager.load().unwrap();
    assert_eq!(config.ui.theme, "dark");
    config.ui.theme = "light".to_string();
    config_manager.save(&config).unwrap();

    // Verify final state
    let final_config = config_manager.load().unwrap();
    assert_eq!(final_config.ui.theme, "light");
}

/// Tests that multiple markdown files can be managed.
#[test]
fn test_storage_multiple_files() {
    let temp_dir = TempDir::new().unwrap();
    let md_storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

    // Save multiple files
    md_storage.save("file1.md", "# File 1").unwrap();
    md_storage.save("file2.md", "# File 2").unwrap();
    md_storage.save("file3.md", "# File 3").unwrap();

    // Verify all files exist
    let files = md_storage.list().unwrap();
    assert_eq!(files.len(), 3);

    // Verify content of each file
    assert_eq!(md_storage.load("file1.md").unwrap(), "# File 1");
    assert_eq!(md_storage.load("file2.md").unwrap(), "# File 2");
    assert_eq!(md_storage.load("file3.md").unwrap(), "# File 3");
}

/// Tests that config and storage can coexist in the same directory.
#[test]
fn test_config_and_storage_coexistence() {
    let temp_dir = TempDir::new().unwrap();
    let base_path = temp_dir.path().to_path_buf();

    // Initialize both managers with the same base path
    let config_manager = ConfigManager::new(base_path.clone());
    let md_storage = MarkdownStorage::new(base_path);

    // Save config
    let mut config = config_manager.load().unwrap();
    config.ui.theme = "dark".to_string();
    config_manager.save(&config).unwrap();

    // Save markdown
    md_storage.save("notes.md", "# My Notes").unwrap();

    // Verify both exist and work
    let loaded_config = config_manager.load().unwrap();
    assert_eq!(loaded_config.ui.theme, "dark");

    let loaded_md = md_storage.load("notes.md").unwrap();
    assert_eq!(loaded_md, "# My Notes");

    // Config file should not appear in markdown list
    let md_files = md_storage.list().unwrap();
    assert_eq!(md_files.len(), 1);
    assert!(md_files.contains(&"notes.md".to_string()));
}
