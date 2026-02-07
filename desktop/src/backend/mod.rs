//! Grapes IDE Backend - Embedded API Server
//! 
//! This module provides the REST API server functionality that can be embedded
//! in the Tauri desktop app. It provides:
//! - Project management API
//! - Schema operations (blocks, pages, APIs, models)
//! - Code generation endpoints
//! - SQLite persistence

pub mod routes;
pub mod state;
pub mod error;
pub mod db;

// Schema is now at the root level

pub use state::AppState as BackendAppState;
pub use error::ApiError;

use axum::{
    routing::{get, post, put, delete, patch},
    Router,
};
use tower_http::cors::{CorsLayer, Any};

/// Create the backend router with all API endpoints
pub fn create_router(state: BackendAppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        
        // Workspace routes
        .route("/api/workspace", get(routes::workspace::get_workspace))
        .route("/api/workspace", post(routes::workspace::set_workspace))
        .route("/api/workspace/pick-folder", get(routes::workspace::pick_folder))
        .route("/api/workspace/projects/:id", get(routes::workspace::load_project))
        .route("/api/workspace/projects/:id", delete(routes::workspace::delete_project))

        // Project routes
        .route("/api/project", get(routes::project::get_project))
        .route("/api/project", post(routes::project::create_project))
        .route("/api/project", patch(routes::project::rename_project))
        .route("/api/project/import", post(routes::project::import_project))
        .route("/api/project/export", get(routes::project::export_project))
        .route("/api/project/reset", post(routes::project::reset_project))
        .route("/api/project/install", post(routes::project::install_project_dependencies))
        .route("/api/project/sync/root", post(routes::project::set_sync_root))
        .route("/api/project/sync/now", post(routes::project::trigger_sync))
        .route("/api/project/sync/from_disk", post(routes::project::sync_disk_to_memory))
        
        // Block routes
        .route("/api/blocks", post(routes::blocks::add_block))
        .route("/api/blocks/:id", put(routes::blocks::update_block))
        .route("/api/blocks/:id", delete(routes::blocks::delete_block))
        
        // Page routes
        .route("/api/pages", post(routes::pages::add_page))
        .route("/api/pages/:id/content", get(routes::pages::get_page_content))
        
        // Logic routes
        .route("/api/logic", get(routes::logic::get_logic_flows))
        .route("/api/logic", post(routes::logic::create_logic_flow))
        .route("/api/logic/:id", delete(routes::logic::delete_logic_flow))
        
        // Data model routes
        .route("/api/models", post(routes::models::add_model))
        .route("/api/models/:id/fields", post(routes::models::add_field))
        
        // API endpoint routes
        .route("/api/endpoints", post(routes::endpoints::add_endpoint))
        
        // Code generation
        .route("/api/generate/frontend", post(routes::generate::generate_frontend))
        .route("/api/generate/backend", post(routes::generate::generate_backend))
        .route("/api/generate/database", post(routes::generate::generate_database))
        .route("/api/generate/zip", get(routes::generate::generate_zip))
        
        // File system routes
        .route("/api/files", get(routes::files::list_directory))
        .route("/api/files", post(routes::files::create_file))
        .route("/api/files/folder", post(routes::files::create_folder))
        .route("/api/files/rename", put(routes::files::rename_file))
        .route("/api/files/delete", delete(routes::files::delete_file))
        .route("/api/files/content", get(routes::files::read_file))
        
        // CORS layer
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(state)
}
