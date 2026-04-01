// src-tauri/src/sidecar/process.rs
use tokio::process::{Child, Command};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use std::process::Stdio;
use std::time::Duration;
use crate::Result;

pub struct SidecarProcess {
    child: Option<Child>,
    python_path: String,
    sidecar_script: String,
}

impl SidecarProcess {
    pub fn new(python_path: String, sidecar_script: String) -> Self {
        Self {
            child: None,
            python_path,
            sidecar_script,
        }
    }

    pub async fn start(&mut self) -> Result<()> {
        let child = Command::new(&self.python_path)
            .arg("-m")
            .arg(&self.sidecar_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        self.child = Some(child);
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        if let Some(ref mut child) = self.child.take() {
            // Try graceful shutdown first with 5-second timeout
            let graceful_shutdown = async {
                // Wait for the process to exit naturally
                for _ in 0..50 {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    if child.try_wait()?.is_some() {
                        return Ok(()) as Result<()>;
                    }
                }
                // Process didn't exit gracefully, force kill
                child.start_kill()?;
                Ok(())
            };

            tokio::time::timeout(Duration::from_secs(5), graceful_shutdown)
                .await
                .map_err(|_| crate::AppError::SidecarError("Graceful shutdown timed out".to_string()))??;
        }
        Ok(())
    }

    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            // Check if process has actually exited using try_wait()
            // Returns Ok(None) if still running, Ok(Some(status)) if exited
            matches!(child.try_wait(), Ok(None))
        } else {
            false
        }
    }

    pub async fn send_message(&mut self, message: &str) -> Result<()> {
        if let Some(ref mut child) = self.child {
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(message.as_bytes()).await?;
                stdin.write_all(b"\n").await?;
            }
        }
        Ok(())
    }

    pub async fn read_message(&mut self) -> Result<Option<String>> {
        if let Some(ref mut child) = self.child {
            if let Some(ref mut stdout) = child.stdout {
                let mut reader = BufReader::new(stdout).lines();
                if let Some(line) = reader.next_line().await? {
                    return Ok(Some(line.trim().to_string()));
                }
            }
        }
        Ok(None)
    }
}

impl Drop for SidecarProcess {
    fn drop(&mut self) {
        // Since stop() is now async, we need to force kill synchronously in Drop
        if let Some(mut child) = self.child.take() {
            let _ = child.start_kill();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sidecar_process_creation() {
        let mut process = SidecarProcess::new(
            "python3".to_string(),
            "sidecar.main".to_string()
        );
        assert!(!process.is_running());
    }
}
