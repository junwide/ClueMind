// src-tauri/src/sidecar/manager.rs
use super::{SidecarProcess, HealthChecker};
use crate::Result;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::timeout;

pub struct SidecarManager {
    process: SidecarProcess,
    health_checker: HealthChecker,
    startup_timeout: Duration,
    max_retries: u32,
}

impl SidecarManager {
    pub fn new(python_path: String, sidecar_script: String) -> Self {
        Self {
            process: SidecarProcess::new(python_path, sidecar_script),
            health_checker: HealthChecker::new(),
            startup_timeout: Duration::from_secs(10),
            max_retries: 2,
        }
    }

    pub async fn start_with_retry(&mut self, app: &AppHandle) -> Result<()> {
        // Emit starting event
        let _ = app.emit("sidecar-status", serde_json::json!({"running": false, "status": "starting"}));

        let mut attempts = 0;

        while attempts <= self.max_retries {
            match self.start().await {
                Ok(_) => {
                    // Emit running event on success
                    let _ = app.emit("sidecar-status", serde_json::json!({"running": true, "status": "running"}));
                    return Ok(());
                }
                Err(_e) if attempts < self.max_retries => {
                    attempts += 1;
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                Err(e) => {
                    // Emit error event on failure
                    let _ = app.emit("sidecar-status", serde_json::json!({"running": false, "error": e.to_string()}));
                    return Err(e);
                }
            }
        }

        // Emit error event when max retries exceeded
        let error_msg = "启动失败，超过最大重试次数".to_string();
        let _ = app.emit("sidecar-status", serde_json::json!({"running": false, "error": error_msg}));
        Err(crate::AppError::SidecarError(error_msg))
    }

    async fn start(&mut self) -> Result<()> {
        self.process.start().await?;

        // Wait for ready signal with timeout
        let ready_future = async {
            loop {
                if let Some(message) = self.process.read_message().await? {
                    if message.contains("\"type\":\"ready\"") {
                        return Ok::<(), crate::AppError>(());
                    }
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        };

        timeout(self.startup_timeout, ready_future).await
            .map_err(|_| crate::AppError::SidecarError("启动超时".to_string()))??;

        self.health_checker.record_heartbeat();
        Ok(())
    }

    pub async fn stop(&mut self, app: &AppHandle) -> Result<()> {
        // Emit stopping event
        let _ = app.emit("sidecar-status", serde_json::json!({"running": false, "status": "stopping"}));

        let result = self.process.stop().await;

        // Emit stopped event
        let _ = app.emit("sidecar-status", serde_json::json!({"running": false, "status": "stopped"}));

        result
    }

    pub fn is_running(&mut self) -> bool {
        self.process.is_running()
    }

    pub fn is_healthy(&self) -> bool {
        self.health_checker.is_healthy()
    }

    /// Send a message to the sidecar and receive the response.
    pub async fn send_and_receive(&mut self, message: serde_json::Value) -> crate::Result<serde_json::Value> {
        let message_str = serde_json::to_string(&message)
            .map_err(|e| crate::AppError::Serialization(e.to_string()))?;

        self.process.send_message(&message_str).await?;

        // Read response
        let response = self.process.read_message().await?
            .ok_or_else(|| crate::AppError::SidecarError("No response from sidecar".to_string()))?;

        let parsed: serde_json::Value = serde_json::from_str(&response)
            .map_err(|e| crate::AppError::Json(e.to_string()))?;

        Ok(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sidecar_manager_creation() {
        let mut manager = SidecarManager::new(
            "python3".to_string(),
            "sidecar.main".to_string()
        );
        assert!(!manager.is_running());
        assert!(manager.is_healthy());
    }
}
