//! Page routes

use axum::{
    extract::{State, Path},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::PageSchema;

/// Add page request
#[derive(Debug, Deserialize)]
pub struct AddPageRequest {
    pub name: String,
    pub path: String,
}

/// Page content response
#[derive(Debug, Serialize)]
pub struct PageContentResponse {
    pub content: String,
}

/// Add a new page
pub async fn add_page(
    State(state): State<AppState>,
    Json(req): Json<AddPageRequest>,
) -> Result<Json<PageSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let page = PageSchema::new(
        uuid::Uuid::new_v4().to_string(),
        &req.name,
        &req.path,
    );
    
    let result = page.clone();
    project.add_page(page);
    
    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        let _ = engine.sync_page_to_disk(&result.id, &project);
    }
    
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Get physical page content from disk
pub async fn get_page_content(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PageContentResponse>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let page = project.find_page(&id)
        .ok_or_else(|| ApiError::NotFound("Page not found".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set. Please set it in project settings.".into()))?;
    
    // Map page to client/page folder (logic from sync_engine.rs)
    let tsx_path = std::path::PathBuf::from(root_path)
        .join("client/page")
        .join(format!("{}.tsx", crate::generator::pascal_case(&page.name)));
    
    if !tsx_path.exists() {
        return Err(ApiError::NotFound(format!("File not found at {:?}", tsx_path)));
    }
    
    let content = std::fs::read_to_string(tsx_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read file: {}", e)))?;
    
    Ok(Json(PageContentResponse { content }))
}
