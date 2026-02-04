//! App state - shared state for the API server

use std::sync::Arc;
use crate::schema::ProjectSchema;
use crate::db::Database;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    /// Database connection
    pub db: Arc<Database>,
}

impl AppState {
    /// Create new app state
    pub fn new() -> Result<Self, anyhow::Error> {
        // Use 'grapes.db' in the current directory
        let db = Database::new("grapes.db")?;
        
        Ok(Self {
            db: Arc::new(db),
        })
    }
    
    /// Get current project from DB
    pub async fn get_project(&self) -> Option<ProjectSchema> {
        // For now, blocking call on the thread pool (Axum handles async)
        // In real app, might want `tokio::task::spawn_blocking`
        self.db.get_project().unwrap_or(None)
    }
    
    /// Set current project (save to DB)
    pub async fn set_project(&self, project: ProjectSchema) {
        if let Err(e) = self.db.save_project(&project) {
            eprintln!("Failed to save project: {}", e);
        }
    }
}
