// src-tauri/src/storage/assets.rs
//! File asset management for multimodal drops.
//! Handles copying files into the app's assets directory and generating thumbnails.

use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use crate::error::{AppError, Result};

/// Manages file assets (images, files, voice recordings).
pub struct AssetManager {
    base_path: PathBuf,
}

impl AssetManager {
    /// Create a new AssetManager rooted at the app data directory.
    pub fn new(data_dir: &Path) -> Self {
        Self {
            base_path: data_dir.join("assets"),
        }
    }

    /// Copy a file into the assets directory under the given category.
    /// Returns the path within the assets directory.
    pub fn copy_to_assets(&self, source_path: &Path, category: &str) -> Result<PathBuf> {
        let category_dir = self.base_path.join(category);
        fs::create_dir_all(&category_dir)
            .map_err(|e| AppError::Io(format!("Failed to create assets category dir: {}", e)))?;

        let extension = source_path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let dest_name = format!("{}.{}", Uuid::new_v4(), extension);
        let dest_path = category_dir.join(&dest_name);

        fs::copy(source_path, &dest_path)
            .map_err(|e| AppError::Io(format!("Failed to copy asset: {}", e)))?;

        // Return relative path within assets
        Ok(PathBuf::from("assets").join(category).join(dest_name))
    }

    /// Get the absolute path for a relative asset path.
    pub fn resolve_path(&self, relative_path: &Path) -> PathBuf {
        if relative_path.is_absolute() {
            relative_path.to_path_buf()
        } else {
            self.base_path.parent()
                .map(|p| p.join(relative_path))
                .unwrap_or_else(|| self.base_path.join(relative_path))
        }
    }

    /// Generate a thumbnail for an image file.
    /// Returns the path to the generated thumbnail.
    pub fn generate_thumbnail(&self, image_path: &Path, max_size: u32) -> Result<PathBuf> {
        let abs_path = self.resolve_path(image_path);
        if !abs_path.exists() {
            return Err(AppError::Storage(format!("Image not found: {:?}", abs_path)));
        }

        let img = image::open(&abs_path)
            .map_err(|e| AppError::Storage(format!("Failed to open image: {}", e)))?;

        let thumbnail = img.thumbnail(max_size, max_size);

        let thumb_dir = self.base_path.join("thumbnails");
        fs::create_dir_all(&thumb_dir)
            .map_err(|e| AppError::Io(format!("Failed to create thumbnails dir: {}", e)))?;

        let stem = abs_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");
        let thumb_name = format!("{}_thumb.png", stem);
        let thumb_path = thumb_dir.join(&thumb_name);

        thumbnail.save(&thumb_path)
            .map_err(|e| AppError::Storage(format!("Failed to save thumbnail: {}", e)))?;

        Ok(PathBuf::from("assets").join("thumbnails").join(thumb_name))
    }

    /// Delete an asset file by its relative path.
    pub fn delete_asset(&self, relative_path: &Path) -> Result<()> {
        let abs_path = self.resolve_path(relative_path);
        if abs_path.exists() {
            fs::remove_file(&abs_path)
                .map_err(|e| AppError::Io(format!("Failed to delete asset: {}", e)))?;
        }
        Ok(())
    }

    /// Get the total size of the assets directory in bytes.
    pub fn get_storage_usage(&self) -> Result<u64> {
        if !self.base_path.exists() {
            return Ok(0);
        }
        let mut total: u64 = 0;
        self.walk_dir(&self.base_path, &mut total)?;
        Ok(total)
    }

    fn walk_dir(&self, dir: &Path, total: &mut u64) -> Result<()> {
        for entry in fs::read_dir(dir)
            .map_err(|e| AppError::Io(format!("Failed to read dir: {}", e)))?
        {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let path = entry.path();
            if path.is_dir() {
                self.walk_dir(&path, total)?;
            } else {
                let metadata = fs::metadata(&path)
                    .map_err(|e| AppError::Io(format!("Failed to read metadata: {}", e)))?;
                *total += metadata.len();
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_copy_to_assets() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        // Create a source file
        let source = dir.path().join("test_image.png");
        fs::write(&source, b"fake image data").unwrap();

        let result = manager.copy_to_assets(&source, "images").unwrap();

        // Verify the file was copied
        assert!(result.to_str().unwrap().contains("images"));
        assert!(result.to_str().unwrap().contains(".png"));

        // Verify the file exists
        let abs = manager.resolve_path(&result);
        assert!(abs.exists());
    }

    #[test]
    fn test_resolve_path_absolute() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let abs = PathBuf::from("/tmp/image.png");
        let resolved = manager.resolve_path(&abs);
        assert_eq!(resolved, abs);
    }

    #[test]
    fn test_resolve_path_relative() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let rel = PathBuf::from("assets/images/test.png");
        let resolved = manager.resolve_path(&rel);
        assert!(resolved.is_absolute());
        assert!(resolved.to_str().unwrap().contains("assets/images/test.png"));
    }

    #[test]
    fn test_delete_asset() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let source = dir.path().join("test_file.txt");
        fs::write(&source, b"content").unwrap();

        let copied = manager.copy_to_assets(&source, "files").unwrap();
        let abs = manager.resolve_path(&copied);
        assert!(abs.exists());

        manager.delete_asset(&copied).unwrap();
        assert!(!abs.exists());
    }

    #[test]
    fn test_delete_nonexistent_asset_ok() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let result = manager.delete_asset(Path::new("assets/nonexistent/file.txt"));
        assert!(result.is_ok());
    }

    #[test]
    fn test_storage_usage_empty() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let usage = manager.get_storage_usage().unwrap();
        assert_eq!(usage, 0);
    }

    #[test]
    fn test_storage_usage_with_files() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        let source = dir.path().join("data.bin");
        fs::write(&source, &[0u8; 1024]).unwrap();
        manager.copy_to_assets(&source, "files").unwrap();

        let usage = manager.get_storage_usage().unwrap();
        assert!(usage >= 1024);
    }

    #[test]
    fn test_generate_thumbnail() {
        let dir = TempDir::new().unwrap();
        let manager = AssetManager::new(dir.path());

        // Create a small test image (2x2 red PNG)
        let img = image::RgbImage::from_pixel(2, 2, image::Rgb([255, 0, 0]));
        let img_path = dir.path().join("test.png");
        img.save(&img_path).unwrap();

        let thumb_path = manager.generate_thumbnail(&img_path, 128).unwrap();

        assert!(thumb_path.to_str().unwrap().contains("thumbnails"));
        let abs = manager.resolve_path(&thumb_path);
        assert!(abs.exists());

        // Verify the thumbnail is a valid image
        let thumb_img = image::open(&abs).unwrap();
        assert!(thumb_img.width() <= 128);
        assert!(thumb_img.height() <= 128);
    }
}
