// src-tauri/src/sidecar/health.rs
use std::time::{Duration, Instant};

pub struct HealthChecker {
    last_heartbeat: Instant,
    pub heartbeat_timeout: Duration,
}

impl Default for HealthChecker {
    fn default() -> Self {
        Self {
            last_heartbeat: Instant::now(),
            heartbeat_timeout: Duration::from_secs(30),
        }
    }
}

impl HealthChecker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_heartbeat(&mut self) {
        self.last_heartbeat = Instant::now();
    }

    pub fn is_healthy(&self) -> bool {
        self.last_heartbeat.elapsed() < self.heartbeat_timeout
    }

    pub fn time_since_last_heartbeat(&self) -> Duration {
        self.last_heartbeat.elapsed()
    }
}
