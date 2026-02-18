//! Akasha — Visual Full-Stack SaaS Builder
//!
//! This is the Rust core engine for Akasha. It handles:
//! - Schema management (the source of truth)
//! - Command execution (all mutations)
//! - Virtual File System
//! - Code generation
//! - Local storage (SQLite)

use tokio::net::TcpListener;

// Module declarations
pub mod backend;
pub mod commands;
pub mod generator;
pub mod schema;
pub mod storage;
pub mod vfs; // Backend API server

// Re-exports
pub use schema::ProjectSchema;

// ============================================================================
// TAURI ENTRY POINT
// ============================================================================

fn backend_bind_addr() -> String {
    if let Ok(bind) = std::env::var("AKASHA_BIND") {
        let trimmed = bind.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3001);

    format!("0.0.0.0:{port}")
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};

        if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
            sigterm.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    let _ = env_logger::try_init();

    log::info!("Starting Akasha (IPC mode — no HTTP server)...");

    let backend_state = match crate::backend::BackendAppState::new() {
        Ok(state) => state,
        Err(e) => {
            log::error!("Failed to initialize backend state: {}", e);
            return;
        }
    };

    let backend_state_clone = backend_state.clone();

    tauri::Builder::default()
        .manage(backend_state.clone())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Set the app handle in the backend state
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let mut app_handle_lock = backend_state_clone.app_handle.lock().await;
                *app_handle_lock = Some(handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ─── Workspace ──────────────────────────────────
            commands::ipc::ipc_get_workspace,
            commands::ipc::ipc_set_workspace,
            commands::ipc::ipc_pick_folder,
            commands::ipc::ipc_load_project_by_id,
            commands::ipc::ipc_delete_project,
            // ─── Project ────────────────────────────────────
            commands::ipc::ipc_get_project,
            commands::ipc::ipc_create_project,
            commands::ipc::ipc_rename_project,
            commands::ipc::ipc_import_project,
            commands::ipc::ipc_export_project,
            commands::ipc::ipc_reset_project,
            commands::ipc::ipc_set_sync_root,
            commands::ipc::ipc_trigger_sync,
            commands::ipc::ipc_sync_from_disk,
            commands::ipc::ipc_install_dependencies,
            commands::ipc::ipc_update_settings,
            // ─── Blocks ─────────────────────────────────────
            commands::ipc::ipc_add_block,
            commands::ipc::ipc_update_block,
            commands::ipc::ipc_delete_block,
            commands::ipc::ipc_move_block,
            // ─── Components ─────────────────────────────────
            commands::ipc::ipc_list_components,
            commands::ipc::ipc_create_component,
            commands::ipc::ipc_get_component,
            // ─── Pages ──────────────────────────────────────
            commands::ipc::ipc_add_page,
            commands::ipc::ipc_update_page,
            commands::ipc::ipc_delete_page,
            commands::ipc::ipc_get_page_content,
            // ─── Logic Flows ────────────────────────────────
            commands::ipc::ipc_get_logic_flows,
            commands::ipc::ipc_create_logic_flow,
            commands::ipc::ipc_update_logic_flow,
            commands::ipc::ipc_delete_logic_flow,
            // ─── Data Models ────────────────────────────────
            commands::ipc::ipc_get_models,
            commands::ipc::ipc_add_model,
            commands::ipc::ipc_update_model,
            commands::ipc::ipc_delete_model,
            commands::ipc::ipc_add_field,
            commands::ipc::ipc_update_field,
            commands::ipc::ipc_delete_field,
            commands::ipc::ipc_add_relation,
            commands::ipc::ipc_delete_relation,
            // ─── Endpoints ──────────────────────────────────
            commands::ipc::ipc_get_endpoints,
            commands::ipc::ipc_add_endpoint,
            commands::ipc::ipc_update_endpoint,
            commands::ipc::ipc_delete_endpoint,
            // ─── Variables ──────────────────────────────────
            commands::ipc::ipc_get_variables,
            commands::ipc::ipc_create_variable,
            commands::ipc::ipc_update_variable,
            commands::ipc::ipc_delete_variable,
            // ─── Code Generation ────────────────────────────
            commands::ipc::ipc_generate_frontend,
            commands::ipc::ipc_generate_backend,
            commands::ipc::ipc_generate_database,
            commands::ipc::ipc_generate_zip,
            commands::ipc::ipc_generate_openapi,
            // ─── File System ────────────────────────────────
            commands::ipc::ipc_list_directory,
            commands::ipc::ipc_create_file,
            commands::ipc::ipc_create_folder,
            commands::ipc::ipc_rename_file,
            commands::ipc::ipc_delete_file,
            commands::ipc::ipc_read_file_content,
            commands::ipc::ipc_write_file_content,
            // ─── Diagrams ───────────────────────────────────
            commands::ipc::ipc_list_diagrams,
            commands::ipc::ipc_create_diagram,
            commands::ipc::ipc_read_diagram,
            commands::ipc::ipc_save_diagram,
            commands::ipc::ipc_delete_diagram,
            // ─── Git Version Control ────────────────────────
            commands::ipc::ipc_git_history,
            commands::ipc::ipc_git_restore,
            commands::ipc::ipc_git_diff,
            commands::ipc::ipc_git_commit,
            commands::ipc::ipc_git_init,
            commands::ipc::ipc_git_status,
            commands::ipc::ipc_git_discard_changes,
            commands::ipc::ipc_git_get_file_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run_headless() -> anyhow::Result<()> {
    let _ = env_logger::try_init();
    log::info!("Starting headless API server...");

    let backend_state = crate::backend::BackendAppState::new()?;
    let router = crate::backend::create_router(backend_state);

    let addr = backend_bind_addr();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async move {
            let listener = TcpListener::bind(&addr).await?;
            log::info!("Backend API server listening on http://{}", addr);

            axum::serve(listener, router)
                .with_graceful_shutdown(shutdown_signal())
                .await?;

            Ok(())
        })
}
