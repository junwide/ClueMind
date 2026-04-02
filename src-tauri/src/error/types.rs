use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Error severity levels for classification and handling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorSeverity {
    /// Low severity - informational or recoverable errors
    Low,
    /// Medium severity - requires user attention but not critical
    Medium,
    /// High severity - critical errors that may prevent operation
    High,
}

/// Application error types with comprehensive coverage
#[derive(Debug, Error, Serialize, Deserialize)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("JSON error: {0}")]
    Json(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Keyring error: {0}")]
    Keyring(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Shortcut error: {0}")]
    Shortcut(String),
}

impl AppError {
    /// Returns the severity level of the error
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            AppError::Validation(_) => ErrorSeverity::Low,
            AppError::Io(_) => ErrorSeverity::Medium,
            AppError::Json(_) => ErrorSeverity::Medium,
            AppError::Serialization(_) => ErrorSeverity::Medium,
            AppError::Storage(_) => ErrorSeverity::Medium,
            AppError::Config(_) => ErrorSeverity::Medium,
            AppError::Keyring(_) => ErrorSeverity::Medium,
            AppError::Api(_) => ErrorSeverity::High,
            AppError::Shortcut(_) => ErrorSeverity::Medium,
        }
    }

    /// Returns a user-friendly message for display in the UI
    pub fn user_message(&self) -> String {
        match self {
            AppError::Io(msg) => format!("File operation failed: {}", msg),
            AppError::Json(msg) => format!("Data format error: {}", msg),
            AppError::Api(msg) => format!("API request failed: {}", msg),
            AppError::Storage(msg) => format!("Storage error: {}", msg),
            AppError::Validation(msg) => format!("Invalid input: {}", msg),
            AppError::Config(msg) => format!("Configuration error: {}", msg),
            AppError::Keyring(msg) => format!("Keyring error: {}", msg),
            AppError::Serialization(msg) => format!("Data serialization error: {}", msg),
            AppError::Shortcut(msg) => format!("Shortcut registration error: {}", msg),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Json(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_severity() {
        assert_eq!(AppError::Validation("test".to_string()).severity(), ErrorSeverity::Low);
        assert_eq!(AppError::Io("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Json("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Storage("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Config("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Keyring("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Serialization("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Shortcut("test".to_string()).severity(), ErrorSeverity::Medium);
        assert_eq!(AppError::Api("test".to_string()).severity(), ErrorSeverity::High);
    }

    #[test]
    fn test_user_message() {
        let error = AppError::Validation("email is required".to_string());
        assert_eq!(error.user_message(), "Invalid input: email is required");
    }

    #[test]
    fn test_from_io_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();
        assert!(matches!(app_error, AppError::Io(_)));
    }

    #[test]
    fn test_from_json_error() {
        let json_error = serde_json::from_str::<String>("invalid json").unwrap_err();
        let app_error: AppError = json_error.into();
        assert!(matches!(app_error, AppError::Json(_)));
    }
}
