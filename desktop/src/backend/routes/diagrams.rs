//! Diagram routes - CRUD operations for Draw.io diagrams
//!
//! Provides endpoints for listing, creating, reading, saving, and deleting diagram files.

use axum::{
    extract::{Path as AxumPath, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::backend::error::ApiError;
use crate::backend::state::AppState;

/// Diagram file entry
#[derive(Debug, Serialize)]
pub struct DiagramEntry {
    pub name: String,
    pub path: String,
    pub last_modified: Option<u64>,
}

/// Create diagram request
#[derive(Debug, Deserialize)]
pub struct CreateDiagramRequest {
    pub name: String,
}

/// Save diagram request
#[derive(Debug, Deserialize)]
pub struct SaveDiagramRequest {
    pub content: String,
}

/// Resolve project root and diagrams folder
fn get_diagrams_dir(root_path: &str) -> Result<PathBuf, ApiError> {
    let root = PathBuf::from(root_path);
    let diagrams_dir = root.join("diagrams");
    
    if !diagrams_dir.exists() {
        fs::create_dir_all(&diagrams_dir)
            .map_err(|e| ApiError::Internal(format!("Failed to create diagrams directory: {}", e)))?;
    }
    
    Ok(diagrams_dir)
}

/// List diagrams
pub async fn list_diagrams(
    State(state): State<AppState>,
) -> Result<Json<Vec<DiagramEntry>>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = get_diagrams_dir(root_path)?;
    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&diagrams_dir)
        .map_err(|e| ApiError::Internal(format!("Failed to read diagrams directory: {}", e)))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| ApiError::Internal(format!("Failed to read entry: {}", e)))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("drawio") {
            let metadata = entry.metadata().ok();
            let name = path.file_stem().unwrap().to_string_lossy().to_string();
            
            entries.push(DiagramEntry {
                name,
                path: path.to_string_lossy().to_string(),
                last_modified: metadata.and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs()),
            });
        }
    }

    // Sort by name
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(Json(entries))
}

/// Create a new diagram
pub async fn create_diagram(
    State(state): State<AppState>,
    Json(req): Json<CreateDiagramRequest>,
) -> Result<Json<DiagramEntry>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = get_diagrams_dir(root_path)?;
    
    // Sanitize name
    let safe_name = sanitize_filename::sanitize(&req.name);
    let file_path = diagrams_dir.join(format!("{}.drawio", safe_name));

    if file_path.exists() {
        return Err(ApiError::BadRequest("Diagram already exists".into()));
    }

    // Default empty draw.io XML
    let content = r#"<mxfile host="Electron" modified="2023-10-01T00:00:00.000Z" agent="5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) draw.io/21.0.0 Chrome/110.0.5481.208 Electron/23.1.4 Safari/537.36" version="21.0.0" etag="W4zF-7u7">
  <diagram id="D1" name="Page-1">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"#;

    fs::write(&file_path, content)
        .map_err(|e| ApiError::Internal(format!("Failed to create diagram file: {}", e)))?;

    Ok(Json(DiagramEntry {
        name: safe_name,
        path: file_path.to_string_lossy().to_string(),
        last_modified: None,
    }))
}

/// Read diagram content
pub async fn read_diagram(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
) -> Result<Json<String>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = get_diagrams_dir(root_path)?;
    let file_path = diagrams_dir.join(format!("{}.drawio", name));

    if !file_path.exists() {
        return Err(ApiError::NotFound("Diagram not found".into()));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read diagram: {}", e)))?;

    Ok(Json(content))
}

/// Save diagram content
pub async fn save_diagram(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
    Json(req): Json<SaveDiagramRequest>,
) -> Result<Json<bool>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = get_diagrams_dir(root_path)?;
    let file_path = diagrams_dir.join(format!("{}.drawio", name));

    fs::write(&file_path, &req.content)
        .map_err(|e| ApiError::Internal(format!("Failed to save diagram: {}", e)))?;

    Ok(Json(true))
}

/// Delete a diagram
pub async fn delete_diagram(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
) -> Result<Json<bool>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = get_diagrams_dir(root_path)?;
    let file_path = diagrams_dir.join(format!("{}.drawio", name));

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| ApiError::Internal(format!("Failed to delete diagram: {}", e)))?;
    }

    Ok(Json(true))
}
