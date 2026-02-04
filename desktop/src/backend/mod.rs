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
use crate::schema;

pub use state::AppState as BackendAppState;
pub use error::ApiError;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};

/// Create the backend router with all API endpoints
pub fn create_router(state: BackendAppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        
        // Project routes
        .route("/api/project", get(routes::project::get_project))
        .route("/api/project", post(routes::project::create_project))
        .route("/api/project/import", post(routes::project::import_project))
        .route("/api/project/export", get(routes::project::export_project))
        
        // Block routes
        .route("/api/blocks", post(routes::blocks::add_block))
        .route("/api/blocks/:id", put(routes::blocks::update_block))
        .route("/api/blocks/:id", delete(routes::blocks::delete_block))
        
        // Page routes
        .route("/api/pages", post(routes::pages::add_page))
        
        // Data model routes
        .route("/api/models", post(routes::models::add_model))
        
        // API endpoint routes
        .route("/api/endpoints", post(routes::endpoints::add_endpoint))
        
        // Code generation
        .route("/api/generate/frontend", post(routes::generate::generate_frontend))
        .route("/api/generate/backend", post(routes::generate::generate_backend))
        .route("/api/generate/database", post(routes::generate::generate_database))
        .route("/api/generate/zip", get(routes::generate::generate_zip))
        
        // CORS layer
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(state)
}
