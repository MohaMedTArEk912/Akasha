//! API endpoint routes

use axum::{
    extract::State,
    Json,
};
use serde::Deserialize;

use crate::{AppState, ApiError};
use crate::schema::{ApiSchema, HttpMethod};

/// Add endpoint request
#[derive(Debug, Deserialize)]
pub struct AddEndpointRequest {
    pub method: String,
    pub path: String,
    pub name: String,
}

/// Add a new API endpoint
pub async fn add_endpoint(
    State(state): State<AppState>,
    Json(req): Json<AddEndpointRequest>,
) -> Result<Json<ApiSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let method = match req.method.to_uppercase().as_str() {
        "GET" => HttpMethod::Get,
        "POST" => HttpMethod::Post,
        "PUT" => HttpMethod::Put,
        "PATCH" => HttpMethod::Patch,
        "DELETE" => HttpMethod::Delete,
        _ => return Err(ApiError::BadRequest(format!("Invalid HTTP method: {}", req.method))),
    };
    
    let api = ApiSchema::new(
        uuid::Uuid::new_v4().to_string(),
        method,
        &req.path,
        &req.name,
    );
    
    let result = api.clone();
    project.add_api(api);
    state.set_project(project).await;
    
    Ok(Json(result))
}
