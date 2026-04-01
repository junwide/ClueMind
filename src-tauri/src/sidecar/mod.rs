// src-tauri/src/sidecar/mod.rs
pub mod manager;
pub mod process;
pub mod health;

pub use manager::SidecarManager;
pub use process::SidecarProcess;
pub use health::HealthChecker;
