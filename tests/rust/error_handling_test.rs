// tests/rust/error_handling_test.rs
use reviewyourmind::*;
use std::time::Duration;

#[test]
fn test_error_severity_mapping() {
    // Low severity
    let validation_err = AppError::Validation("test".to_string());
    assert_eq!(validation_err.severity(), ErrorSeverity::Low);

    // Medium severity
    let io_err = AppError::Io("test".to_string());
    assert_eq!(io_err.severity(), ErrorSeverity::Medium);

    let json_err = AppError::Json("test".to_string());
    assert_eq!(json_err.severity(), ErrorSeverity::Medium);

    let storage_err = AppError::Storage("test".to_string());
    assert_eq!(storage_err.severity(), ErrorSeverity::Medium);

    let config_err = AppError::Config("test".to_string());
    assert_eq!(config_err.severity(), ErrorSeverity::Medium);

    let keyring_err = AppError::Keyring("test".to_string());
    assert_eq!(keyring_err.severity(), ErrorSeverity::Medium);

    let serialization_err = AppError::Serialization("test".to_string());
    assert_eq!(serialization_err.severity(), ErrorSeverity::Medium);

    // High severity
    let sidecar_err = AppError::SidecarError("test".to_string());
    assert_eq!(sidecar_err.severity(), ErrorSeverity::High);

    let api_err = AppError::Api("test".to_string());
    assert_eq!(api_err.severity(), ErrorSeverity::High);
}

#[test]
fn test_user_message_generation() {
    let error = AppError::Validation("email is required".to_string());
    assert_eq!(error.user_message(), "Invalid input: email is required");

    let error = AppError::Io("file not found".to_string());
    assert_eq!(error.user_message(), "File operation failed: file not found");

    let error = AppError::SidecarError("connection refused".to_string());
    assert_eq!(error.user_message(), "Background service error: connection refused");

    let error = AppError::Api("rate limit exceeded".to_string());
    assert_eq!(error.user_message(), "API request failed: rate limit exceeded");

    let error = AppError::Storage("disk full".to_string());
    assert_eq!(error.user_message(), "Storage error: disk full");

    let error = AppError::Config("invalid key".to_string());
    assert_eq!(error.user_message(), "Configuration error: invalid key");

    let error = AppError::Keyring("access denied".to_string());
    assert_eq!(error.user_message(), "Keyring error: access denied");

    let error = AppError::Serialization("invalid format".to_string());
    assert_eq!(error.user_message(), "Data serialization error: invalid format");
}

#[test]
fn test_recovery_strategy_selection() {
    // Retry strategy
    assert_eq!(AppError::Io("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);
    assert_eq!(AppError::Api("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);
    assert_eq!(AppError::Storage("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);

    // None strategy
    assert_eq!(AppError::Json("test".to_string()).recovery_strategy(), RecoveryStrategy::None);
    assert_eq!(AppError::Validation("test".to_string()).recovery_strategy(), RecoveryStrategy::None);
    assert_eq!(AppError::Serialization("test".to_string()).recovery_strategy(), RecoveryStrategy::None);

    // Reset strategy
    assert_eq!(AppError::SidecarError("test".to_string()).recovery_strategy(), RecoveryStrategy::Reset);

    // Fallback strategy
    assert_eq!(AppError::Config("test".to_string()).recovery_strategy(), RecoveryStrategy::Fallback);

    // Escalate strategy
    assert_eq!(AppError::Keyring("test".to_string()).recovery_strategy(), RecoveryStrategy::Escalate);
}

#[test]
fn test_is_retryable() {
    // Retryable errors
    assert!(AppError::Io("test".to_string()).is_retryable());
    assert!(AppError::Api("test".to_string()).is_retryable());
    assert!(AppError::Storage("test".to_string()).is_retryable());

    // Non-retryable errors
    assert!(!AppError::Json("test".to_string()).is_retryable());
    assert!(!AppError::Validation("test".to_string()).is_retryable());
    assert!(!AppError::SidecarError("test".to_string()).is_retryable());
    assert!(!AppError::Config("test".to_string()).is_retryable());
    assert!(!AppError::Keyring("test".to_string()).is_retryable());
    assert!(!AppError::Serialization("test".to_string()).is_retryable());
}

#[test]
fn test_is_recoverable() {
    // Recoverable errors
    assert!(AppError::Io("test".to_string()).is_recoverable());
    assert!(AppError::Api("test".to_string()).is_recoverable());
    assert!(AppError::Storage("test".to_string()).is_recoverable());
    assert!(AppError::SidecarError("test".to_string()).is_recoverable());
    assert!(AppError::Config("test".to_string()).is_recoverable());
    assert!(AppError::Keyring("test".to_string()).is_recoverable());

    // Non-recoverable errors
    assert!(!AppError::Json("test".to_string()).is_recoverable());
    assert!(!AppError::Validation("test".to_string()).is_recoverable());
    assert!(!AppError::Serialization("test".to_string()).is_recoverable());
}

#[test]
fn test_recovery_strategy_description() {
    assert!(!RecoveryStrategy::None.description().is_empty());
    assert!(!RecoveryStrategy::Retry.description().is_empty());
    assert!(!RecoveryStrategy::Fallback.description().is_empty());
    assert!(!RecoveryStrategy::Reset.description().is_empty());
    assert!(!RecoveryStrategy::Escalate.description().is_empty());
}

#[test]
fn test_retry_config_default() {
    let config = RetryConfig::default();
    assert_eq!(config.max_attempts, 3);
    assert_eq!(config.initial_delay, Duration::from_millis(100));
    assert_eq!(config.max_delay, Duration::from_secs(10));
    assert!((config.multiplier - 2.0).abs() < f64::EPSILON);
}

#[test]
fn test_retry_config_builder() {
    let config = RetryConfig::new()
        .max_attempts(5)
        .initial_delay(Duration::from_millis(200))
        .max_delay(Duration::from_secs(30))
        .multiplier(1.5);

    assert_eq!(config.max_attempts, 5);
    assert_eq!(config.initial_delay, Duration::from_millis(200));
    assert_eq!(config.max_delay, Duration::from_secs(30));
    assert!((config.multiplier - 1.5).abs() < f64::EPSILON);
}

#[test]
fn test_retry_config_calculate_delay() {
    let config = RetryConfig::new()
        .initial_delay(Duration::from_millis(100))
        .max_delay(Duration::from_millis(1000))
        .multiplier(2.0);

    // With jitter (10-50%), actual delay is in range [base, base*1.5]
    let d1 = config.calculate_delay(1).as_millis();
    assert!((100..=150).contains(&d1), "delay 1 should be 100-150ms, got {}ms", d1);

    let d2 = config.calculate_delay(2).as_millis();
    assert!((200..=300).contains(&d2), "delay 2 should be 200-300ms, got {}ms", d2);

    let d3 = config.calculate_delay(3).as_millis();
    assert!((400..=600).contains(&d3), "delay 3 should be 400-600ms, got {}ms", d3);

    let d4 = config.calculate_delay(4).as_millis();
    assert!((800..=1000).contains(&d4), "delay 4 should be 800-1000ms, got {}ms", d4);

    // Capped at max_delay (1000ms * 1.5 = 1500ms max with jitter, but capped)
    let d5 = config.calculate_delay(5).as_millis();
    assert!((1000..=1500).contains(&d5), "delay 5 should be 1000-1500ms (capped), got {}ms", d5);
}

#[test]
fn test_from_io_error() {
    let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
    let app_error: AppError = io_error.into();
    assert!(matches!(app_error, AppError::Io(_)));
    assert!(app_error.to_string().contains("file not found"));
}

#[test]
fn test_from_json_error() {
    let json_error = serde_json::from_str::<String>("invalid json").unwrap_err();
    let app_error: AppError = json_error.into();
    assert!(matches!(app_error, AppError::Json(_)));
}

#[tokio::test]
async fn test_retry_with_backoff_success() {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_clone = attempts.clone();

    let config = RetryConfig::new()
        .max_attempts(3)
        .initial_delay(Duration::from_millis(1));

    let result: std::result::Result<i32, &str> = retry_with_backoff(config, move || {
        let attempts = attempts_clone.clone();
        async move {
            let count = attempts.fetch_add(1, Ordering::SeqCst);
            if count < 2 {
                Err("not yet")
            } else {
                Ok(42)
            }
        }
    })
    .await;

    assert_eq!(result, Ok(42));
    assert_eq!(attempts.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn test_retry_with_backoff_all_fail() {
    let config = RetryConfig::new()
        .max_attempts(3)
        .initial_delay(Duration::from_millis(1));

    let result: std::result::Result<i32, &str> = retry_with_backoff(config, || async { Err("always fails") }).await;

    assert_eq!(result, Err("always fails"));
}

#[test]
fn test_error_display() {
    let error = AppError::Storage("test message".to_string());
    assert_eq!(format!("{}", error), "Storage error: test message");

    let error = AppError::SidecarError("crashed".to_string());
    assert_eq!(format!("{}", error), "Sidecar error: crashed");

    let error = AppError::Api("timeout".to_string());
    assert_eq!(format!("{}", error), "API error: timeout");
}
