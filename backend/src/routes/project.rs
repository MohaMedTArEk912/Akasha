//! Project routes

use axum::{
    extract::State,
    Json,
};
use serde::Deserialize;

use crate::{AppState, ApiError};
use crate::schema::ProjectSchema;

/// Create project request
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

/// Get current project
pub async fn get_project(
    State(state): State<AppState>,
) -> Result<Json<Option<ProjectSchema>>, ApiError> {
    let project = state.get_project().await;
    Ok(Json(project))
}

/// Create new project
pub async fn create_project(
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let project = ProjectSchema::new(
        uuid::Uuid::new_v4().to_string(),
        req.name,
    );
    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Import project from JSON
#[derive(Debug, Deserialize)]
pub struct ImportProjectRequest {
    pub json: String,
}

pub async fn import_project(
    State(state): State<AppState>,
    Json(req): Json<ImportProjectRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let project = ProjectSchema::from_json(&req.json)
        .map_err(|e| ApiError::BadRequest(format!("Invalid JSON: {}", e)))?;
    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Export project to JSON
pub async fn export_project(
    State(state): State<AppState>,
) -> Result<Json<String>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    let json = project.to_json()
        .map_err(|e| ApiError::Internal(format!("Serialization error: {}", e)))?;
    Ok(Json(json))
}
