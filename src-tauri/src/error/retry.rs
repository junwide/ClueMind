use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;
use rand::Rng;

/// Configuration for retry behavior with exponential backoff
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_attempts: u32,
    /// Initial delay before first retry
    pub initial_delay: Duration,
    /// Maximum delay between retries
    pub max_delay: Duration,
    /// Multiplier for exponential backoff
    pub multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(10),
            multiplier: 2.0,
        }
    }
}

impl RetryConfig {
    /// Creates a new RetryConfig with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets the maximum number of retry attempts
    pub fn max_attempts(mut self, attempts: u32) -> Self {
        self.max_attempts = attempts;
        self
    }

    /// Sets the initial delay before first retry
    pub fn initial_delay(mut self, delay: Duration) -> Self {
        self.initial_delay = delay;
        self
    }

    /// Sets the maximum delay between retries
    pub fn max_delay(mut self, delay: Duration) -> Self {
        self.max_delay = delay;
        self
    }

    /// Sets the multiplier for exponential backoff
    pub fn multiplier(mut self, mult: f64) -> Self {
        self.multiplier = mult;
        self
    }

    /// Calculates the delay for a given attempt number with jitter
    pub fn calculate_delay(&self, attempt: u32) -> Duration {
        let delay_ms = self.initial_delay.as_millis() as f64
            * self.multiplier.powi(attempt.saturating_sub(1) as i32);

        // Add 10-50% random jitter to prevent thundering herd problem
        let jitter = rand::thread_rng().gen_range(0.1..0.5);
        let final_delay = delay_ms * (1.0 + jitter);

        let capped_delay = final_delay.min(self.max_delay.as_millis() as f64);
        Duration::from_millis(capped_delay as u64)
    }
}

/// Executes an async operation with exponential backoff retry logic
///
/// # Arguments
/// * `config` - Retry configuration
/// * `operation` - Async operation to execute
///
/// # Returns
/// The result of the operation if successful, or the last error if all retries fail
pub async fn retry_with_backoff<F, Fut, T, E>(
    config: RetryConfig,
    mut operation: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Debug,
{
    let mut last_error: Option<E> = None;

    for attempt in 1..=config.max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(error) => {
                last_error = Some(error);
                if attempt < config.max_attempts {
                    let delay = config.calculate_delay(attempt);
                    tracing::debug!(
                        "Attempt {} failed, retrying in {:?}",
                        attempt,
                        delay
                    );
                    sleep(delay).await;
                }
            }
        }
    }

    Err(last_error.expect("At least one attempt should have been made"))
}

/// Executes an async operation with retry logic and a predicate to determine if retry should occur
///
/// # Arguments
/// * `config` - Retry configuration
/// * `should_retry` - Predicate to determine if error is retryable
/// * `operation` - Async operation to execute
///
/// # Returns
/// The result of the operation if successful, or the last error if all retries fail
pub async fn retry_with_predicate<F, Fut, T, E, P>(
    config: RetryConfig,
    mut should_retry: P,
    mut operation: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    P: FnMut(&E) -> bool,
    E: std::fmt::Debug,
{
    let mut last_error: Option<E> = None;

    for attempt in 1..=config.max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(error) => {
                let is_retryable = should_retry(&error);
                last_error = Some(error);
                if attempt < config.max_attempts && is_retryable {
                    let delay = config.calculate_delay(attempt);
                    tracing::debug!(
                        "Attempt {} failed with retryable error, retrying in {:?}",
                        attempt,
                        delay
                    );
                    sleep(delay).await;
                } else if !is_retryable {
                    tracing::debug!("Attempt {} failed with non-retryable error", attempt);
                    break;
                }
            }
        }
    }

    Err(last_error.expect("At least one attempt should have been made"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.initial_delay, Duration::from_millis(100));
        assert_eq!(config.max_delay, Duration::from_secs(10));
        assert_eq!(config.multiplier, 2.0);
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
        assert_eq!(config.multiplier, 1.5);
    }

    #[test]
    fn test_calculate_delay_with_jitter() {
        let config = RetryConfig::new()
            .initial_delay(Duration::from_millis(100))
            .max_delay(Duration::from_millis(1000))
            .multiplier(2.0);

        // With 10-50% jitter, delays should be within expected ranges
        // Base delays: 100, 200, 400, 800, then capped at 1000

        // Attempt 1: base 100ms, with jitter (10-50%) -> 110-150ms
        let d1 = config.calculate_delay(1);
        assert!(d1 >= Duration::from_millis(110) && d1 <= Duration::from_millis(150));

        // Attempt 2: base 200ms, with jitter -> 220-300ms
        let d2 = config.calculate_delay(2);
        assert!(d2 >= Duration::from_millis(220) && d2 <= Duration::from_millis(300));

        // Attempt 3: base 400ms, with jitter -> 440-600ms
        let d3 = config.calculate_delay(3);
        assert!(d3 >= Duration::from_millis(440) && d3 <= Duration::from_millis(600));

        // Attempt 4: base 800ms, with jitter -> 880-1200ms, capped at 1000ms
        let d4 = config.calculate_delay(4);
        assert!(d4 >= Duration::from_millis(880) && d4 <= Duration::from_millis(1000));

        // Attempt 10: would be way over max, capped at 1000ms, with jitter still capped
        let d10 = config.calculate_delay(10);
        assert!(d10 <= Duration::from_millis(1000));
    }

    #[tokio::test]
    async fn test_retry_success_on_first_attempt() {
        let config = RetryConfig::new().max_attempts(3);
        let result: Result<i32, &str> = retry_with_backoff(config, || async { Ok(42) }).await;
        assert_eq!(result, Ok(42));
    }

    #[tokio::test]
    async fn test_retry_success_on_second_attempt() {
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();

        let config = RetryConfig::new()
            .max_attempts(3)
            .initial_delay(Duration::from_millis(10));

        let result: Result<i32, &str> = retry_with_backoff(config, move || {
            let attempts = attempts_clone.clone();
            async move {
                let count = attempts.fetch_add(1, Ordering::SeqCst);
                if count == 0 {
                    Err("first attempt failed")
                } else {
                    Ok(42)
                }
            }
        })
        .await;

        assert_eq!(result, Ok(42));
        assert_eq!(attempts.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn test_retry_all_attempts_fail() {
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();

        let config = RetryConfig::new()
            .max_attempts(3)
            .initial_delay(Duration::from_millis(10));

        let result: Result<i32, &str> = retry_with_backoff(config, move || {
            let attempts = attempts_clone.clone();
            async move {
                attempts.fetch_add(1, Ordering::SeqCst);
                Err("always fails")
            }
        })
        .await;

        assert_eq!(result, Err("always fails"));
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_retry_with_predicate_non_retryable() {
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();

        let config = RetryConfig::new()
            .max_attempts(3)
            .initial_delay(Duration::from_millis(10));

        let result: Result<i32, &str> = retry_with_predicate(
            config,
            |err| *err != "non-retryable",
            move || {
                let attempts = attempts_clone.clone();
                async move {
                    attempts.fetch_add(1, Ordering::SeqCst);
                    Err("non-retryable")
                }
            },
        )
        .await;

        assert_eq!(result, Err("non-retryable"));
        // Should only attempt once since error is non-retryable
        assert_eq!(attempts.load(Ordering::SeqCst), 1);
    }
}
