mod error;
mod models;
pub mod storage;
mod config;
mod ai;
mod commands;
pub mod shortcuts;
pub mod sync;
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
use tauri::{Emitter, Listener, Manager};
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::create_text_drop,
            commands::create_url_drop,
            commands::create_image_drop,
            commands::create_file_drop,
            commands::create_voice_drop,
            commands::get_drop,
            commands::list_drops,
            commands::list_drops_by_status,
            commands::delete_drop,
            commands::update_drop,
            commands::search_drops,
            commands::list_drops_paginated,
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
            commands::generate_guidance_questions,
            commands::list_framework_graph,
            commands::list_material_graph,
            commands::analyze_image,
            commands::analyze_image_drop,
            commands::transcribe_audio,
            commands::export_full_backup,
            commands::import_full_backup,
            commands::export_custom_backup,
            commands::save_sync_config,
            commands::get_sync_config,
            commands::save_sync_token,
            commands::get_sync_token,
            commands::delete_sync_token,
            commands::test_server_connection,
            commands::sync_now,
            commands::get_sync_status,
            commands::rebuild_sync_engine,
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

            // Migrate keyring entries from old service name if needed
            config::KeyringManager::migrate_from_old_service();

            // Initialize DropStorage
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            // Initialize StorageIndex (SQLite)
            let db_path = app_data_dir.join("index.db");
            let storage_index = storage::StorageIndex::new(&db_path)
                .expect("Failed to initialize StorageIndex");
            let storage_index_arc = std::sync::Arc::new(storage_index);

            // Run JSON → SQLite migration if needed
            storage::migrate_from_json(&app_data_dir, &storage_index_arc)
                .expect("Failed to run migration");

            let storage_index_state: crate::commands::StorageIndexState = storage_index_arc.clone();
            app.manage(storage_index_state);

            let mut drop_storage = storage::DropStorage::new(app_data_dir.clone());
            drop_storage.set_storage_index(std::sync::Arc::clone(&storage_index_arc));
            let drop_storage_state: crate::commands::DropStorageState = Arc::new(Mutex::new(drop_storage));
            app.manage(drop_storage_state.clone()); // clone for sync engine access

            // Keep references for sync engine
            let sync_drop_storage = Arc::clone(&drop_storage_state) as Arc<Mutex<storage::DropStorage>>;
            let sync_storage_index = storage_index_arc.clone();

            // Initialize ConversationStorage (also used for framework storage)
            let mut conversation_storage = storage::ConversationStorage::new(app_data_dir.clone());
            conversation_storage.set_storage_index(storage_index_arc);
            let storage_state: crate::commands::StorageState = Arc::new(Mutex::new(conversation_storage));
            app.manage(storage_state);

            // Initialize AssetManager
            let asset_manager = storage::AssetManager::new(&app_data_dir);
            let asset_manager_state: crate::commands::AssetManagerState = std::sync::Arc::new(asset_manager);
            app.manage(asset_manager_state);

            // Initialize SyncEngine (if sync is configured)
            let sync_engine_state: crate::commands::sync_commands::SyncEngineState = {
                let config_dir = dirs::config_dir();
                let sync_config_path = config_dir.as_ref().map(|d| d.join("DropMind").join("sync_config.json"));
                let sync_config = sync_config_path
                    .and_then(|p| if p.exists() { std::fs::read_to_string(p).ok() } else { None })
                    .and_then(|c| serde_json::from_str::<crate::commands::sync_commands::SyncConfigData>(&c).ok());

                match sync_config {
                    Some(cfg) if cfg.enabled => {
                        let token = config::KeyringManager::new()
                            .get_api_key("sync_server")
                            .ok();
                        match (cfg.server_url, token) {
                            (Some(url), Some(tok)) => {
                                let engine = sync::SyncEngine::new(
                                    &url,
                                    &tok,
                                    sync_drop_storage.clone(),
                                    sync_storage_index.clone(),
                                    app_data_dir.clone(),
                                );
                                tracing::info!("Sync engine initialized for {}", url);
                                Arc::new(Mutex::new(Some(engine)))
                            }
                            _ => Arc::new(Mutex::new(None)),
                        }
                    }
                    _ => Arc::new(Mutex::new(None)),
                }
            };
            app.manage(sync_engine_state.clone());

            // Event listener: rebuild sync engine when config changes (hot-reload)
            {
                let engine_state = sync_engine_state.clone();
                let drop_storage_clone = sync_drop_storage.clone();
                let storage_index_clone = sync_storage_index.clone();
                let data_dir_clone = app_data_dir.clone();
                app.listen("sync-config-changed", move |_| {
                    let engine_state = engine_state.clone();
                    let drop_storage = drop_storage_clone.clone();
                    let storage_index = storage_index_clone.clone();
                    let data_dir = data_dir_clone.clone();
                    // listen callback is not in Tokio runtime — use std::thread + block_on
                    std::thread::spawn(move || {
                        tauri::async_runtime::block_on(async move {
                        let config_dir = dirs::config_dir();
                        let sync_config_path = config_dir.as_ref().map(|d| d.join("DropMind").join("sync_config.json"));
                        let sync_config = sync_config_path
                            .and_then(|p| if p.exists() { std::fs::read_to_string(p).ok() } else { None })
                            .and_then(|c| serde_json::from_str::<crate::commands::sync_commands::SyncConfigData>(&c).ok());

                        let token = config::KeyringManager::new()
                            .get_api_key("sync_server")
                            .ok();

                        let new_engine = match (sync_config, token) {
                            (Some(cfg), Some(tok)) if cfg.enabled => {
                                match cfg.server_url {
                                    Some(url) => {
                                        tracing::info!("Rebuilding sync engine for {}", url);
                                        Some(sync::SyncEngine::new(
                                            &url,
                                            &tok,
                                            drop_storage,
                                            storage_index,
                                            data_dir,
                                        ))
                                    }
                                    None => None,
                                }
                            }
                            _ => None,
                        };

                        let mut guard = engine_state.lock().await;
                        *guard = new_engine;
                        });
                    });
                });
            }

            // Auto-sync background task (uses try_lock to avoid blocking user-initiated sync)
            {
                let engine_state = sync_engine_state.clone();
                let app_handle = app.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Wait for app to settle
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;

                    // Load interval from config
                    let interval_minutes = {
                        let config_dir = dirs::config_dir();
                        let sync_config_path = config_dir.as_ref().map(|d| d.join("DropMind").join("sync_config.json"));
                        sync_config_path
                            .and_then(|p| if p.exists() { std::fs::read_to_string(p).ok() } else { None })
                            .and_then(|c| serde_json::from_str::<crate::commands::sync_commands::SyncConfigData>(&c).ok())
                            .map(|c| c.auto_sync_interval_minutes)
                            .unwrap_or(30)
                    };

                    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_minutes * 60));
                    loop {
                        ticker.tick().await;
                        // Use try_lock to skip if user-initiated sync is running
                        let guard = match engine_state.try_lock() {
                            Ok(g) => g,
                            Err(_) => {
                                tracing::debug!("Auto-sync skipped: sync already in progress");
                                continue;
                            }
                        };
                        if let Some(engine) = guard.as_ref() {
                            match engine.sync().await {
                                Ok(status) => {
                                    if let Err(e) = app_handle.emit("sync-status-changed", &status) {
                                        tracing::warn!("Failed to emit sync-status-changed: {}", e);
                                    }
                                    tracing::debug!("Auto-sync completed: pushed={}, pulled={}", status.pushed_count, status.pulled_count);
                                }
                                Err(e) => {
                                    tracing::warn!("Auto-sync failed: {}", e);
                                }
                            }
                        }
                    }
                });
            }

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
