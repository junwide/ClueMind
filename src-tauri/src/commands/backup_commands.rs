// src-tauri/src/commands/backup_commands.rs
//! Backup and export commands.
//! Supports full backup (ZIP), custom selective backup (ZIP), and import.

use std::path::Path;
use tauri::State;
use crate::error::{AppError, Result};

// Re-use StorageState from ai_commands
use super::ai_commands::StorageState;
use super::drop_commands::StorageIndexState;

/// Manifest file included in backups for version info.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub version: String,
    pub created_at: String,
    pub drop_count: usize,
    pub framework_count: usize,
    pub conversation_count: usize,
    pub include_config: bool,
}

/// Helper to add a directory recursively to a ZIP.
fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    dir_path: &Path,
    prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<usize> {
    let mut count = 0usize;
    if !dir_path.exists() {
        return Ok(0);
    }
    for entry in std::fs::read_dir(dir_path)
        .map_err(|e| AppError::Io(format!("Failed to read dir: {}", e)))?
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip index files (they'll be rebuilt from migration)
        if name == "index.json" || name == "index.db" {
            continue;
        }

        let zip_path = format!("{}/{}", prefix, name);

        if path.is_dir() {
            count += add_dir_to_zip(zip, &path, &zip_path, options)?;
        } else {
            let data = std::fs::read(&path)
                .map_err(|e| AppError::Io(format!("Failed to read {}: {}", path.display(), e)))?;
            zip.start_file(&zip_path, options)
                .map_err(|e| AppError::Storage(format!("Zip write error: {}", e)))?;
            std::io::Write::write_all(zip, &data)
                .map_err(|e| AppError::Io(format!("Zip write error: {}", e)))?;
            count += 1;
        }
    }
    Ok(count)
}

/// Helper to add a single JSON file to ZIP.
fn add_json_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    zip_path: &str,
    json: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<()> {
    zip.start_file(zip_path, options)
        .map_err(|e| AppError::Storage(format!("Zip write error: {}", e)))?;
    std::io::Write::write_all(zip, json.as_bytes())
        .map_err(|e| AppError::Io(format!("Zip write error: {}", e)))?;
    Ok(())
}

/// Export a full backup as a ZIP file.
/// The ZIP contains: drops/, frameworks/, conversations/, assets/, manifest.json
#[tauri::command]
pub async fn export_full_backup(
    dest_path: String,
    storage: State<'_, StorageState>,
) -> Result<String> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| AppError::Storage("Invalid base path".to_string()))?
        .to_path_buf();
    drop(storage);

    let dest = Path::new(&dest_path);

    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(format!("Failed to create backup directory: {}", e)))?;
    }

    let file = std::fs::File::create(dest)
        .map_err(|e| AppError::Io(format!("Failed to create backup file: {}", e)))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut drop_count = 0usize;
    let mut framework_count = 0usize;
    let mut conversation_count = 0usize;

    // Add drops
    let drops_dir = base_path.join("drops");
    if drops_dir.exists() {
        drop_count = add_dir_to_zip(&mut zip, &drops_dir, "drops", options)?;
    }

    // Add frameworks
    let frameworks_dir = base_path.join("frameworks");
    if frameworks_dir.exists() {
        framework_count = add_dir_to_zip(&mut zip, &frameworks_dir, "frameworks", options)?;
    }

    // Add conversations
    let convs_dir = base_path.join("conversations");
    if convs_dir.exists() {
        conversation_count = add_dir_to_zip(&mut zip, &convs_dir, "conversations", options)?;
    }

    // Add assets
    let assets_dir = base_path.join("assets");
    if assets_dir.exists() {
        add_dir_to_zip(&mut zip, &assets_dir, "assets", options)?;
    }

    // Write manifest
    let manifest = BackupManifest {
        version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        drop_count,
        framework_count,
        conversation_count,
        include_config: false,
    };
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| AppError::Serialization(e.to_string()))?;
    add_json_to_zip(&mut zip, "manifest.json", &manifest_json, options)?;

    zip.finish()
        .map_err(|e| AppError::Storage(format!("Failed to finalize zip: {}", e)))?;

    Ok(dest_path)
}

/// Export a custom selective backup as a ZIP file.
/// Includes only selected frameworks, drops, and optionally config files.
#[tauri::command]
pub async fn export_custom_backup(
    dest_path: String,
    framework_ids: Vec<String>,
    drop_ids: Vec<String>,
    include_config: bool,
    storage: State<'_, StorageState>,
    drop_storage: State<'_, crate::commands::DropStorageState>,
) -> Result<String> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| AppError::Storage("Invalid base path".to_string()))?
        .to_path_buf();
    drop(storage);

    let dest = Path::new(&dest_path);

    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(format!("Failed to create backup directory: {}", e)))?;
    }

    let file = std::fs::File::create(dest)
        .map_err(|e| AppError::Io(format!("Failed to create backup file: {}", e)))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut drop_count = 0usize;
    let mut framework_count = 0usize;
    let mut conversation_count = 0usize;

    // Export selected frameworks
    for id in &framework_ids {
        let fw_path = base_path.join("frameworks").join(format!("{}.json", id));
        if fw_path.exists() {
            let data = std::fs::read(&fw_path)
                .map_err(|e| AppError::Io(format!("Failed to read framework {}: {}", id, e)))?;
            let zip_path = format!("frameworks/{}.json", id);
            zip.start_file(&zip_path, options)
                .map_err(|e| AppError::Storage(format!("Zip write error: {}", e)))?;
            std::io::Write::write_all(&mut zip, &data)
                .map_err(|e| AppError::Io(format!("Zip write error: {}", e)))?;
            framework_count += 1;
        }
    }

    // Export selected drops + associated assets
    let ds = drop_storage.lock().await;
    for id in &drop_ids {
        let drop_path = base_path.join("drops").join(format!("{}.json", id));
        if drop_path.exists() {
            let data = std::fs::read(&drop_path)
                .map_err(|e| AppError::Io(format!("Failed to read drop {}: {}", id, e)))?;
            let zip_path = format!("drops/{}.json", id);
            zip.start_file(&zip_path, options)
                .map_err(|e| AppError::Storage(format!("Zip write error: {}", e)))?;
            std::io::Write::write_all(&mut zip, &data)
                .map_err(|e| AppError::Io(format!("Zip write error: {}", e)))?;
            drop_count += 1;

            // Copy associated asset files if they exist
            if let Ok(drop) = serde_json::from_slice::<serde_json::Value>(&data) {
                if let Some(path_str) = drop["content"]["path"].as_str() {
                    let asset_src = Path::new(path_str);
                    if asset_src.exists() && asset_src.starts_with(&base_path) {
                        if let Some(name) = asset_src.file_name().and_then(|n| n.to_str()) {
                            let category = match drop["content"]["type"].as_str() {
                                Some("image") => "images",
                                Some("voice") => "voice",
                                _ => "files",
                            };
                            let asset_data = std::fs::read(asset_src)
                                .map_err(|e| AppError::Io(format!("Failed to read asset: {}", e)))?;
                            let asset_zip = format!("assets/{}/{}", category, name);
                            zip.start_file(&asset_zip, options)
                                .map_err(|e| AppError::Storage(format!("Zip write error: {}", e)))?;
                            std::io::Write::write_all(&mut zip, &asset_data)
                                .map_err(|e| AppError::Io(format!("Zip write error: {}", e)))?;
                        }
                    }
                }
            }
        }
    }
    drop(ds);

    // Export conversations related to selected frameworks
    let convs_dir = base_path.join("conversations");
    if convs_dir.exists() {
        for entry in std::fs::read_dir(&convs_dir)
            .map_err(|e| AppError::Io(format!("Failed to read conversations dir: {}", e)))?
        {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let path = entry.path();

            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(conv) = serde_json::from_str::<serde_json::Value>(&content) {
                        // Check if this conversation is related to any selected framework
                        let fw_id = conv["frameworkId"].as_str()
                            .or_else(|| conv["framework_id"].as_str());
                        if let Some(fwid) = fw_id {
                            if framework_ids.contains(&fwid.to_string()) {
                                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                                    let zip_path = format!("conversations/{}", name);
                                    add_json_to_zip(&mut zip, &zip_path, &content, options)?;
                                    conversation_count += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Optionally export config files
    if include_config {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::Storage("Cannot find config directory".to_string()))?;
        let app_config_dir = config_dir.join("DropMind");

        let provider_config = app_config_dir.join("provider_configs.json");
        if provider_config.exists() {
            let data = std::fs::read_to_string(&provider_config)
                .map_err(|e| AppError::Io(format!("Failed to read provider config: {}", e)))?;
            add_json_to_zip(&mut zip, "config/provider_configs.json", &data, options)?;
        }

        let prompt_config = app_config_dir.join("prompt_config.json");
        if prompt_config.exists() {
            let data = std::fs::read_to_string(&prompt_config)
                .map_err(|e| AppError::Io(format!("Failed to read prompt config: {}", e)))?;
            add_json_to_zip(&mut zip, "config/prompt_config.json", &data, options)?;
        }
    }

    // Write manifest
    let manifest = BackupManifest {
        version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        drop_count,
        framework_count,
        conversation_count,
        include_config,
    };
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| AppError::Serialization(e.to_string()))?;
    add_json_to_zip(&mut zip, "manifest.json", &manifest_json, options)?;

    zip.finish()
        .map_err(|e| AppError::Storage(format!("Failed to finalize zip: {}", e)))?;

    Ok(format!("Exported {} frameworks, {} drops, {} conversations", framework_count, drop_count, conversation_count))
}

/// Import a backup from a ZIP file.
/// Extracts and replaces all data, restores config if present, then rebuilds the SQLite index.
#[tauri::command]
pub async fn import_full_backup(
    source_path: String,
    storage: State<'_, StorageState>,
    index_state: State<'_, StorageIndexState>,
) -> Result<String> {
    let storage = storage.lock().await;
    let base_path = storage.base_path().parent()
        .ok_or_else(|| AppError::Storage("Invalid base path".to_string()))?
        .to_path_buf();
    drop(storage);

    let source = Path::new(&source_path);
    if !source.exists() {
        return Err(AppError::Storage(format!("Backup file not found: {}", source_path)));
    }

    let file = std::fs::File::open(source)
        .map_err(|e| AppError::Io(format!("Failed to open backup: {}", e)))?;

    let mut archive = zip::read::ZipArchive::new(file)
        .map_err(|e| AppError::Storage(format!("Invalid zip file: {}", e)))?;

    // Extract each entry
    let mut extracted = 0usize;
    let mut has_config = false;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| AppError::Storage(format!("Zip read error: {}", e)))?;

        let name = entry.name().to_string();

        // Security: reject path traversal entries (e.g. "../../etc/passwd")
        if name.contains("..") || name.starts_with('/') {
            continue;
        }

        let dest = base_path.join(&name);

        // Verify the resolved path stays within base_path
        let canonical_base = base_path.canonicalize().unwrap_or_else(|_| base_path.to_path_buf());
        if let Some(parent) = dest.parent() {
            if let Ok(canonical_dest) = parent.canonicalize() {
                if !canonical_dest.starts_with(&canonical_base) {
                    continue;
                }
            }
        }

        // Skip manifest
        if name == "manifest.json" {
            continue;
        }

        // Create parent directory
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Io(format!("Failed to create dir: {}", e)))?;
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&dest)
                .map_err(|e| AppError::Io(format!("Failed to create dir: {}", e)))?;
        } else {
            let mut outfile = std::fs::File::create(&dest)
                .map_err(|e| AppError::Io(format!("Failed to create file: {}", e)))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| AppError::Io(format!("Failed to extract: {}", e)))?;
            extracted += 1;

            // Track if config files were found
            if name.starts_with("config/") {
                has_config = true;
            }
        }
    }

    // Restore config files from data dir to config dir
    if has_config {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::Storage("Cannot find config directory".to_string()))?;
        let app_config_dir = config_dir.join("DropMind");
        std::fs::create_dir_all(&app_config_dir)
            .map_err(|e| AppError::Storage(format!("Failed to create config dir: {}", e)))?;

        // Move config files from extracted location to config dir
        let extracted_config_dir = base_path.join("config");
        if extracted_config_dir.exists() {
            for entry in std::fs::read_dir(&extracted_config_dir)
                .map_err(|e| AppError::Io(format!("Failed to read config dir: {}", e)))?
            {
                let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
                let src_path = entry.path();
                if let Some(name) = src_path.file_name().and_then(|n| n.to_str()) {
                    let dst_path = app_config_dir.join(name);
                    std::fs::copy(&src_path, &dst_path)
                        .map_err(|e| AppError::Io(format!("Failed to restore config: {}", e)))?;
                }
            }
            // Clean up extracted config dir from data dir
            let _ = std::fs::remove_dir_all(&extracted_config_dir);
        }
    }

    // Rebuild SQLite index by deleting old index and re-migrating from JSON files
    let db_path = base_path.join("index.db");
    if db_path.exists() {
        std::fs::remove_file(&db_path)
            .map_err(|e| AppError::Io(format!("Failed to remove old index: {}", e)))?;
    }
    crate::storage::migrate_from_json(&base_path, &index_state)
        .map_err(|e| AppError::Storage(format!("Failed to rebuild index: {}", e)))?;

    Ok(format!("Restored {} files{}", extracted, if has_config { " + config" } else { "" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_backup_manifest_serialization() {
        let manifest = BackupManifest {
            version: "0.3.0".to_string(),
            created_at: "2026-04-08T10:00:00Z".to_string(),
            drop_count: 5,
            framework_count: 2,
            conversation_count: 1,
            include_config: true,
        };

        let json = serde_json::to_string_pretty(&manifest).unwrap();
        let parsed: BackupManifest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.version, "0.3.0");
        assert_eq!(parsed.drop_count, 5);
        assert_eq!(parsed.framework_count, 2);
        assert_eq!(parsed.conversation_count, 1);
        assert!(parsed.include_config);
    }

    #[test]
    fn test_backup_manifest_camel_case() {
        let manifest = BackupManifest {
            version: "0.3.0".to_string(),
            created_at: "2026-04-08T10:00:00Z".to_string(),
            drop_count: 3,
            framework_count: 1,
            conversation_count: 0,
            include_config: false,
        };

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains("createdAt"));
        assert!(json.contains("dropCount"));
        assert!(json.contains("frameworkCount"));
        assert!(json.contains("conversationCount"));
        assert!(json.contains("includeConfig"));
    }
}
