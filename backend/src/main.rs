//! Grapes IDE Backend - Rust API Server
//! 
//! This is the standalone backend server that provides:
//! - Project management API
//! - Schema operations (blocks, pages, APIs, models)
//! - Code generation endpoints
//! - SQLite persistence

mod routes;
mod schema;
mod state;
mod error;
mod db;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub use state::AppState;
pub use error::ApiError;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "grapes_backend=debug,tower_http=debug".into()))
        .init();

    // Create app state
    let state = AppState::new().expect("Failed to initialize app state");

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        
        // Project routes
        .route("/api/project", get(routes::project::get_project))
        .route("/api/project", post(routes::project::create_project))
        .route("/api/project/import", post(routes::project::import_project))
        .route("/api/project/export", get(routes::project::export_project))
        
        // Block routes
        .route("/api/blocks", post(routes::blocks::add_block))
        .route("/api/blocks/{id}", put(routes::blocks::update_block))
        .route("/api/blocks/{id}", delete(routes::blocks::delete_block))
        
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
        
        // Static file serving (frontend)
        .fallback_service({
            let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../frontend/dist".to_string());
            tower_http::services::ServeDir::new(&static_dir)
                .fallback(tower_http::services::ServeFile::new(format!("{}/index.html", static_dir)))
        })
        
        // CORS layer
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(state);

    // Start server
    // For docker compatibility, bind to 0.0.0.0
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    tracing::info!("🍇 Grapes Backend listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
