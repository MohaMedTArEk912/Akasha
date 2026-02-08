//! Workspace management routes

use axum::{
    extract::{State, Path},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::ProjectSchema;

/// Workspace status response
#[derive(Debug, Serialize)]
pub struct WorkspaceStatus {
    pub workspace_path: Option<String>,
    pub projects: Vec<ProjectSchema>,
}

/// Set workspace request
#[derive(Debug, Deserialize)]
pub struct SetWorkspaceRequest {
    pub path: String,
}

/// Get workspace status
pub async fn get_workspace(
    State(state): State<AppState>,
) -> Result<Json<WorkspaceStatus>, ApiError> {
    let workspace_path = state.get_workspace_path().await;
    let projects = state.get_all_projects().await;
    
    Ok(Json(WorkspaceStatus {
        workspace_path,
        projects,
    }))
}

/// Set global workspace path
pub async fn set_workspace(
    State(state): State<AppState>,
    Json(req): Json<SetWorkspaceRequest>,
) -> Result<Json<bool>, ApiError> {
    state.set_workspace_path(req.path).await;
    Ok(Json(true))
}

/// Load specific project
pub async fn load_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let project = state.get_project_by_id(&id).await
        .ok_or_else(|| ApiError::NotFound(format!("Project {} not found", id)))?;
    
    // Explicitly set as "current" if we had that concept, but for now 
    // we just return it to the frontend which will treat it as current.
    
    Ok(Json(project))
}

/// Delete project request
#[derive(Debug, Deserialize)]
pub struct DeleteProjectRequest {
    pub delete_from_disk: Option<bool>,
}

/// Delete project
pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Option<Json<DeleteProjectRequest>>,
) -> Result<Json<bool>, ApiError> {
    // Get project info before deleting
    let project = state.get_project_by_id(&id).await;
    
    // Delete from disk if requested and project has root_path
    if let Some(Json(req)) = body {
        if req.delete_from_disk.unwrap_or(false) {
            if let Some(proj) = &project {
                if let Some(root_path) = &proj.root_path {
                    let path = std::path::PathBuf::from(root_path);
                    if path.exists() {
                        std::fs::remove_dir_all(&path).map_err(|e| {
                            ApiError::Internal(format!("Failed to delete project folder: {}", e))
                        })?;
                    }
                }
            }
        }
    }
    
    let success = state.delete_project(&id).await;
    Ok(Json(success))
}

/// Pick a folder using native dialog
pub async fn pick_folder() -> Result<Json<Option<String>>, ApiError> {
    // Note: rfd will block the current thread which is okay 
    // for a desktop app UI interaction like this.
    // In a high-concurrency server we would use spawn_blocking.
    let folder = rfd::FileDialog::new()
        .set_title("Choose Workspace Folder")
        .pick_folder();
    
    Ok(Json(folder.map(|p| p.to_string_lossy().to_string())))
}
