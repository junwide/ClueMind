//! Error handling module for DropMind application
//!
//! This module provides comprehensive error handling including:
//! - Error types with severity levels
//! - Retry logic with exponential backoff
//! - Recovery strategy selection

mod recovery;
mod retry;
mod types;

// Re-export all public components
pub use recovery::{RecoveryStrategy};
pub use retry::{retry_with_backoff, retry_with_predicate, RetryConfig};
pub use types::{AppError, ErrorSeverity, Result};

// Note: This module maintains backward compatibility with existing code
// that uses AppError variants. The variant names are:
// - Io, Json, SidecarError, Api, Storage, Validation, Config, Keyring, Serialization

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = AppError::Storage("file not found".to_string());
        assert_eq!(format!("{}", error), "Storage error: file not found");
    }

    #[test]
    fn test_config_error_display() {
        let error = AppError::Config("invalid config".to_string());
        assert_eq!(format!("{}", error), "Config error: invalid config");
    }

    #[test]
    fn test_backward_compatibility() {
        // Test that existing variant names still work
        let _io_err = AppError::Io("test".to_string());
        let _json_err = AppError::Json("test".to_string());
        let _sidecar_err = AppError::SidecarError("test".to_string());
        let _api_err = AppError::Api("test".to_string());
        let _storage_err = AppError::Storage("test".to_string());
        let _validation_err = AppError::Validation("test".to_string());
        let _config_err = AppError::Config("test".to_string());
        let _keyring_err = AppError::Keyring("test".to_string());
        let _serialization_err = AppError::Serialization("test".to_string());
    }
}
