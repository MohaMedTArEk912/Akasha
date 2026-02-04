//! Page routes

use axum::{
    extract::State,
    Json,
};
use serde::Deserialize;

use crate::{AppState, ApiError};
use crate::schema::PageSchema;

/// Add page request
#[derive(Debug, Deserialize)]
pub struct AddPageRequest {
    pub name: String,
    pub path: String,
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
    state.set_project(project).await;
    
    Ok(Json(result))
}
