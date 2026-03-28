use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Keyring error: {0}")]
    Keyring(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_error_display() {
        let error = AppError::Storage("file not found".to_string());
        assert_eq!(format!("{}", error), "Storage error: file not found");
    }

    #[test]
    fn test_config_error_display() {
        let error = AppError::Config("invalid config".to_string());
        assert_eq!(format!("{}", error), "Config error: invalid config");
    }
}
