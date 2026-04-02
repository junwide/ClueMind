mod error;
mod models;
pub mod storage;
mod config;
mod ai;
mod commands;
pub mod shortcuts;
#[allow(hidden_glob_reexports)]
mod framework;

pub use error::{AppError, ErrorSeverity, RecoveryStrategy, Result, RetryConfig, retry_with_backoff, retry_with_predicate};
// Explicit re-exports to avoid ambiguity between models::drop and storage::drop
pub use models::{
    Drop, DropContent, DropMetadata, DropSource, DropStatus,
    KnowledgeFramework, FrameworkNode, FrameworkEdge, NodeState, EdgeState,
    StructureType, Position, NodeMetadata, FrameworkLifecycle,
    AppConfig, LLMConfig, ProviderConfig, UIConfig, StorageConfig, LoggingConfig, LLMProvider,
};
pub use storage::{DropStorage, DropSummary, MarkdownStorage, JsonMetadataStorage};
pub use config::{ConfigManager, KeyringManager};
pub use ai::*;
pub use commands::*;
pub use shortcuts::*;
pub use framework::*;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Emitter, Manager};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Recursively copy a directory and all its contents.
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cluemind=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::create_text_drop,
            commands::create_url_drop,
            commands::create_image_drop,
            commands::get_drop,
            commands::list_drops,
            commands::list_drops_by_status,
            commands::delete_drop,
            commands::update_drop,
            commands::save_api_key,
            commands::get_api_key,
            commands::delete_api_key,
            commands::save_provider_config,
            commands::get_provider_config,
            commands::test_api_key,
            commands::save_framework,
            commands::load_framework,
            commands::delete_framework,
            commands::list_frameworks,
            commands::list_framework_summaries,
            commands::call_ai,
            commands::generate_frameworks,
            commands::refine_framework,
            commands::summarize_conversation,
            commands::save_conversation,
            commands::load_conversation,
            commands::list_conversations,
            commands::delete_conversation,
            commands::save_prompt_config,
            commands::get_prompt_config,
        ])
        .setup(|app| {
            // Migrate data from old identifier (com.reviewyourmind.app) if needed
            // Tauri creates the new data dir before setup runs, so we check for
            // the absence of app data subdirs rather than the dir itself.
            if let Ok(new_data_dir) = app.path().app_data_dir() {
                let old_data_dir = dirs::data_local_dir()
                    .map(|d| d.join("com.reviewyourmind.app"));

                if let Some(ref old_dir) = old_data_dir {
                    let has_old_data = old_dir.join("drops").exists()
                        || old_dir.join("frameworks").exists()
                        || old_dir.join("conversations").exists();
                    let new_data_empty = !new_data_dir.join("drops").exists()
                        && !new_data_dir.join("frameworks").exists()
                        && !new_data_dir.join("conversations").exists();

                    if has_old_data && new_data_empty {
                        tracing::info!("Migrating data from {:?} to {:?}", old_dir, new_data_dir);
                        for subdir in &["drops", "frameworks", "conversations"] {
                            let src = old_dir.join(subdir);
                            if src.exists() {
                                let dst = new_data_dir.join(subdir);
                                if let Err(e) = copy_dir_recursive(&src, &dst) {
                                    tracing::warn!("Failed to migrate {}: {}", subdir, e);
                                } else {
                                    tracing::info!("Migrated {} successfully", subdir);
                                }
                            }
                        }
                    }
                }
            }

            // Initialize DropStorage
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            let drop_storage = storage::DropStorage::new(app_data_dir.clone());
            let drop_storage_state: crate::commands::DropStorageState = Arc::new(Mutex::new(drop_storage));
            app.manage(drop_storage_state);

            // Initialize ConversationStorage (also used for framework storage)
            let conversation_storage = storage::ConversationStorage::new(app_data_dir);
            let storage_state: crate::commands::StorageState = Arc::new(Mutex::new(conversation_storage));
            app.manage(storage_state);

            // Initialize and register global shortcuts
            let shortcut_manager = ShortcutManager::new();
            let app_handle = app.app_handle().clone();

            match shortcut_manager.register_with_fallback(&app_handle, move |app, _shortcut, event| {
                use tauri_plugin_global_shortcut::ShortcutState;
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Quick drop shortcut triggered");
                    // Emit event to frontend
                    if let Err(e) = app.emit("quick-drop-triggered", ()) {
                        tracing::error!("Failed to emit quick-drop-triggered event: {}", e);
                    }
                }
            }) {
                Ok(registered_shortcut) => {
                    tracing::info!("Global shortcut registered successfully: {:?}", registered_shortcut);
                }
                Err(e) => {
                    tracing::error!("Failed to register global shortcut: {}", e);
                }
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
