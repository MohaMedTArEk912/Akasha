//! Logic flow routes
use axum::{
    extract::{State, Path},
    Json,
};
use serde::Deserialize;
use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::logic_flow::{LogicFlowSchema, TriggerType, FlowContext};

#[derive(Debug, Deserialize)]
pub struct CreateLogicFlowRequest {
    pub name: String,
    pub context: String, // "frontend" or "backend"
}

/// Create a new logic flow
pub async fn create_logic_flow(
    State(state): State<AppState>,
    Json(payload): Json<CreateLogicFlowRequest>,
) -> Result<Json<LogicFlowSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let context = match payload.context.as_str() {
        "frontend" => FlowContext::Frontend,
        "backend" => FlowContext::Backend,
        other => return Err(ApiError::BadRequest(format!("Unknown context: '{}'. Must be 'frontend' or 'backend'", other))),
    };
    
    // Default manual trigger for new flows
    let flow = LogicFlowSchema::new(id, payload.name, TriggerType::Manual, context);
    
    project.logic_flows.push(flow.clone());
    state.set_project(project).await;
    
    Ok(Json(flow))
}

/// Get all logic flows
pub async fn get_logic_flows(
    State(state): State<AppState>,
) -> Result<Json<Vec<LogicFlowSchema>>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let flows = project.logic_flows.iter()
        .filter(|f| !f.archived)
        .cloned()
        .collect();
    
    Ok(Json(flows))
}

/// Delete a logic flow (archive)
pub async fn delete_logic_flow(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let mut found = false;
    for flow in project.logic_flows.iter_mut() {
        if flow.id == id {
            flow.archived = true;
            found = true;
            break;
        }
    }
    
    if found {
        state.set_project(project).await;
    }
    
    Ok(Json(found))
}
