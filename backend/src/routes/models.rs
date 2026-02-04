//! Data model routes

use axum::{
    extract::State,
    Json,
};
use serde::Deserialize;

use crate::{AppState, ApiError};
use crate::schema::DataModelSchema;

/// Add model request
#[derive(Debug, Deserialize)]
pub struct AddModelRequest {
    pub name: String,
}

/// Add a new data model
pub async fn add_model(
    State(state): State<AppState>,
    Json(req): Json<AddModelRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = DataModelSchema::new(
        uuid::Uuid::new_v4().to_string(),
        &req.name,
    );
    
    let result = model.clone();
    project.add_data_model(model);
    state.set_project(project).await;
    
    Ok(Json(result))
}
