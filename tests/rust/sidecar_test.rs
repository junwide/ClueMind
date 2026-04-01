// tests/sidecar_test.rs
use reviewyourmind::*;
use std::time::Duration;

#[test]
fn test_health_checker() {
    let checker = HealthChecker::new();
    assert!(checker.is_healthy());
}

#[test]
fn test_health_checker_timeout() {
    let mut checker = HealthChecker::new();
    checker.heartbeat_timeout = Duration::from_millis(2);
    std::thread::sleep(Duration::from_millis(3));
    assert!(!checker.is_healthy());
}

#[test]
fn test_health_checker_record_heartbeat() {
    let mut checker = HealthChecker::new();
    checker.record_heartbeat();
    assert!(checker.is_healthy());
}

#[tokio::test]
async fn test_sidecar_process_creation() {
    let mut process = SidecarProcess::new(
        "python3".to_string(),
        "sidecar.main".to_string()
    );
    assert!(!process.is_running());
}

#[tokio::test]
async fn test_sidecar_manager_creation() {
    let mut manager = SidecarManager::new(
        "python3".to_string(),
        "sidecar.main".to_string()
    );
    assert!(!manager.is_running());
    // HealthChecker is initialized with current time, so it's healthy initially
    // In a real scenario, it would become unhealthy after timeout
    assert!(manager.is_healthy());
}
