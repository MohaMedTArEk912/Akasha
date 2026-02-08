//! App state - shared state for the API server

use std::sync::Arc;
use crate::schema::ProjectSchema;
use crate::backend::db::Database;

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
    
    /// Get all projects from DB
    pub async fn get_all_projects(&self) -> Vec<ProjectSchema> {
        self.db.get_all_projects().unwrap_or_else(|e| {
            log::error!("Failed to load projects from database: {}", e);
            Vec::new()
        })
    }

    /// Get current project from DB (returns the most recently updated project, fully loaded)
    pub async fn get_project(&self) -> Option<ProjectSchema> {
        let projects = self.db.get_all_projects()
            .map_err(|e| log::error!("Failed to load projects: {}", e))
            .ok()?;
        let first = projects.first()?;
        self.db.get_project_by_id(&first.id).unwrap_or_else(|e| {
            log::error!("Failed to load full project {}: {}", first.id, e);
            None
        })
    }

    /// Get project by ID
    pub async fn get_project_by_id(&self, id: &str) -> Option<ProjectSchema> {
        self.db.get_project_by_id(id).unwrap_or_else(|e| {
            log::error!("Failed to load project {}: {}", id, e);
            None
        })
    }

    /// Set current project (save to DB)
    pub async fn set_project(&self, project: ProjectSchema) {
        if let Err(e) = self.db.save_project(&project) {
            log::error!("Failed to save project '{}': {}", project.name, e);
        }
    }

    /// Delete project
    pub async fn delete_project(&self, id: &str) -> bool {
        match self.db.delete_project(id) {
            Ok(()) => true,
            Err(e) => {
                log::error!("Failed to delete project {}: {}", id, e);
                false
            }
        }
    }

    /// Workspace path management
    pub async fn get_workspace_path(&self) -> Option<String> {
        self.db.get_workspace_path().unwrap_or_else(|e| {
            log::error!("Failed to load workspace path: {}", e);
            None
        })
    }

    pub async fn set_workspace_path(&self, path: String) {
        if let Err(e) = self.db.set_workspace_path(&path) {
            log::error!("Failed to save workspace path: {}", e);
        }
    }
}
