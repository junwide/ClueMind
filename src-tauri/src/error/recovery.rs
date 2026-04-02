use super::types::AppError;

/// Recovery strategies for handling errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecoveryStrategy {
    /// No automatic recovery possible, requires user intervention
    None,
    /// Retry the operation automatically
    Retry,
    /// Use a fallback value or mechanism
    Fallback,
    /// Reset state and try again
    Reset,
    /// Escalate to higher-level handler or user
    Escalate,
}

impl AppError {
    /// Returns the recommended recovery strategy for this error
    pub fn recovery_strategy(&self) -> RecoveryStrategy {
        match self {
            // IO errors may be transient, worth retrying
            AppError::Io(_) => RecoveryStrategy::Retry,

            // JSON/Serialization errors require fixing input, can't auto-retry
            AppError::Json(_) => RecoveryStrategy::None,
            AppError::Serialization(_) => RecoveryStrategy::None,

            // API errors might be transient (rate limits, network issues)
            AppError::Api(_) => RecoveryStrategy::Retry,

            // Storage errors may be recoverable with retry
            AppError::Storage(_) => RecoveryStrategy::Retry,

            // Validation errors need user to fix input
            AppError::Validation(_) => RecoveryStrategy::None,

            // Config errors may need fallback to defaults
            AppError::Config(_) => RecoveryStrategy::Fallback,

            // Keyring errors may need alternative storage or user intervention
            AppError::Keyring(_) => RecoveryStrategy::Escalate,

            // Shortcut errors can use fallback shortcuts
            AppError::Shortcut(_) => RecoveryStrategy::Fallback,
        }
    }

    /// Checks if the error is retryable based on recovery strategy
    pub fn is_retryable(&self) -> bool {
        matches!(self.recovery_strategy(), RecoveryStrategy::Retry)
    }

    /// Checks if the error can be recovered from automatically
    pub fn is_recoverable(&self) -> bool {
        !matches!(self.recovery_strategy(), RecoveryStrategy::None)
    }
}

impl RecoveryStrategy {
    /// Returns a human-readable description of the recovery strategy
    pub fn description(&self) -> &'static str {
        match self {
            RecoveryStrategy::None => "No automatic recovery available",
            RecoveryStrategy::Retry => "Will retry automatically",
            RecoveryStrategy::Fallback => "Using fallback mechanism",
            RecoveryStrategy::Reset => "Will reset and retry",
            RecoveryStrategy::Escalate => "Requires escalation",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recovery_strategy_mapping() {
        assert_eq!(AppError::Io("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);
        assert_eq!(AppError::Json("test".to_string()).recovery_strategy(), RecoveryStrategy::None);
        assert_eq!(AppError::Api("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);
        assert_eq!(AppError::Storage("test".to_string()).recovery_strategy(), RecoveryStrategy::Retry);
        assert_eq!(AppError::Validation("test".to_string()).recovery_strategy(), RecoveryStrategy::None);
        assert_eq!(AppError::Config("test".to_string()).recovery_strategy(), RecoveryStrategy::Fallback);
        assert_eq!(AppError::Keyring("test".to_string()).recovery_strategy(), RecoveryStrategy::Escalate);
        assert_eq!(AppError::Shortcut("test".to_string()).recovery_strategy(), RecoveryStrategy::Fallback);
        assert_eq!(AppError::Serialization("test".to_string()).recovery_strategy(), RecoveryStrategy::None);
    }

    #[test]
    fn test_is_retryable() {
        assert!(AppError::Io("test".to_string()).is_retryable());
        assert!(AppError::Api("test".to_string()).is_retryable());
        assert!(AppError::Storage("test".to_string()).is_retryable());
        assert!(!AppError::Json("test".to_string()).is_retryable());
        assert!(!AppError::Validation("test".to_string()).is_retryable());
    }

    #[test]
    fn test_is_recoverable() {
        assert!(AppError::Io("test".to_string()).is_recoverable());
        assert!(AppError::Api("test".to_string()).is_recoverable());
        assert!(AppError::Storage("test".to_string()).is_recoverable());
        assert!(AppError::Config("test".to_string()).is_recoverable());
        assert!(AppError::Keyring("test".to_string()).is_recoverable());
        assert!(!AppError::Json("test".to_string()).is_recoverable());
        assert!(!AppError::Validation("test".to_string()).is_recoverable());
        assert!(!AppError::Serialization("test".to_string()).is_recoverable());
    }

    #[test]
    fn test_recovery_strategy_description() {
        assert_eq!(RecoveryStrategy::None.description(), "No automatic recovery available");
        assert_eq!(RecoveryStrategy::Retry.description(), "Will retry automatically");
        assert_eq!(RecoveryStrategy::Fallback.description(), "Using fallback mechanism");
        assert_eq!(RecoveryStrategy::Reset.description(), "Will reset and retry");
        assert_eq!(RecoveryStrategy::Escalate.description(), "Requires escalation");
    }
}
