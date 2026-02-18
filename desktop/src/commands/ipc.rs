//! Tauri IPC commands — thin wrappers around the existing Axum route handlers.
//!
//! Each command:
//! 1. Takes `State<'_, BackendAppState>` (Tauri managed state)
//! 2. Builds the Axum extractor shims (`axum::extract::State`, `Json`, `Path`, `Query`)
//! 3. Delegates to the existing handler function in `backend::routes::*`
//! 4. Converts the response from `Result<Json<T>, ApiError>` → `Result<T, String>`
//!
//! This avoids duplicating any business logic.

use serde::Deserialize;
use tauri::State;

use crate::backend::error::ApiError;
use crate::backend::BackendAppState;

// Re-export types the frontend will receive
use crate::backend::routes;

/// Helper: convert `ApiError` to `String` for Tauri IPC.
fn map_err(e: ApiError) -> String {
    e.to_string()
}

// ============================================================================
// WORKSPACE
// ============================================================================

#[tauri::command]
pub async fn ipc_get_workspace(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::workspace::get_workspace(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_set_workspace(
    state: State<'_, BackendAppState>,
    path: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::workspace::SetWorkspaceRequest { path });
    let json = routes::workspace::set_workspace(ax, body).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_pick_folder() -> Result<Option<String>, String> {
    let json = routes::workspace::pick_folder().await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_load_project_by_id(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::workspace::load_project(ax, path).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct DeleteProjectArgs {
    pub id: String,
    pub delete_from_disk: Option<bool>,
}

#[tauri::command]
pub async fn ipc_delete_project(
    state: State<'_, BackendAppState>,
    id: String,
    delete_from_disk: Option<bool>,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let body = if delete_from_disk.unwrap_or(false) {
        Some(axum::Json(routes::workspace::DeleteProjectRequest {
            delete_from_disk: Some(true),
        }))
    } else {
        None
    };
    let json = routes::workspace::delete_project(ax, path, body).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// PROJECT
// ============================================================================

#[tauri::command]
pub async fn ipc_get_project(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::project::get_project(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_project(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::project::CreateProjectRequest { name });
    let json = routes::project::create_project(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_rename_project(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::project::RenameProjectRequest { name });
    let json = routes::project::rename_project(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_import_project(
    state: State<'_, BackendAppState>,
    json_str: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::project::ImportProjectRequest { json: json_str });
    let json = routes::project::import_project(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_export_project(
    state: State<'_, BackendAppState>,
) -> Result<String, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::project::export_project(ax).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_reset_project(
    state: State<'_, BackendAppState>,
    clear_disk_files: Option<bool>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = if clear_disk_files.unwrap_or(false) {
        Some(axum::Json(routes::project::ResetProjectRequest {
            clear_disk_files: Some(true),
        }))
    } else {
        None
    };
    let json = routes::project::reset_project(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_set_sync_root(
    state: State<'_, BackendAppState>,
    path: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::project::SetSyncRootRequest { path });
    let json = routes::project::set_sync_root(ax, body).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_trigger_sync(
    state: State<'_, BackendAppState>,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::project::trigger_sync(ax).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_sync_from_disk(
    state: State<'_, BackendAppState>,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::project::sync_disk_to_memory(ax).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_install_dependencies(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::project::install_project_dependencies(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_settings(
    state: State<'_, BackendAppState>,
    settings: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::project::UpdateSettingsRequest { settings });
    let json = routes::project::update_settings(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

// ============================================================================
// BLOCKS
// ============================================================================

#[tauri::command]
pub async fn ipc_add_block(
    state: State<'_, BackendAppState>,
    block_type: String,
    name: String,
    parent_id: Option<String>,
    page_id: Option<String>,
    component_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::blocks::AddBlockRequest {
        block_type,
        name,
        parent_id,
        page_id,
        component_id,
    });
    let json = routes::blocks::add_block(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_block(
    state: State<'_, BackendAppState>,
    id: String,
    property: String,
    value: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let body = axum::Json(routes::blocks::UpdateBlockRequest { property, value });
    let json = routes::blocks::update_block(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_block(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::blocks::delete_block(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_move_block(
    state: State<'_, BackendAppState>,
    id: String,
    new_parent_id: Option<String>,
    index: usize,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let body = axum::Json(routes::blocks::MoveBlockRequest {
        new_parent_id,
        index,
    });
    let json = routes::blocks::move_block(ax, path, body).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// COMPONENTS
// ============================================================================

#[tauri::command]
pub async fn ipc_list_components(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::components::list_components(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_component(
    state: State<'_, BackendAppState>,
    name: String,
    description: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::components::CreateComponentRequest { name, description });
    let json = routes::components::create_component(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_get_component(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::components::get_component(ax, path).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

// ============================================================================
// PAGES
// ============================================================================

#[tauri::command]
pub async fn ipc_add_page(
    state: State<'_, BackendAppState>,
    name: String,
    path: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::pages::AddPageRequest { name, path });
    let json = routes::pages::add_page(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_page(
    state: State<'_, BackendAppState>,
    id: String,
    name: Option<String>,
    path: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path_ex = axum::extract::Path(id);
    let body = axum::Json(routes::pages::UpdatePageRequest { name, path });
    let json = routes::pages::update_page(ax, path_ex, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_page(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::pages::delete_page(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_get_page_content(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::pages::get_page_content(ax, path).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

// ============================================================================
// LOGIC FLOWS
// ============================================================================

#[tauri::command]
pub async fn ipc_get_logic_flows(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::logic::get_logic_flows(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_logic_flow(
    state: State<'_, BackendAppState>,
    name: String,
    context: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::logic::CreateLogicFlowRequest { name, context });
    let json = routes::logic::create_logic_flow(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_logic_flow(
    state: State<'_, BackendAppState>,
    id: String,
    name: Option<String>,
    nodes: Option<serde_json::Value>,
    entry_node_id: Option<Option<String>>,
    description: Option<String>,
    trigger: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);

    // Deserialize nodes and trigger from serde_json::Value
    let nodes_parsed = match nodes {
        Some(v) => Some(serde_json::from_value(v).map_err(|e| format!("Invalid nodes: {}", e))?),
        None => None,
    };
    let trigger_parsed = match trigger {
        Some(v) => Some(serde_json::from_value(v).map_err(|e| format!("Invalid trigger: {}", e))?),
        None => None,
    };

    let body = axum::Json(routes::logic::UpdateLogicFlowRequest {
        name,
        nodes: nodes_parsed,
        entry_node_id,
        description,
        trigger: trigger_parsed,
    });
    let json = routes::logic::update_logic_flow(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_logic_flow(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::logic::delete_logic_flow(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// DATA MODELS
// ============================================================================

#[tauri::command]
pub async fn ipc_get_models(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::models::get_models(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_add_model(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::models::AddModelRequest { name });
    let json = routes::models::add_model(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_model(
    state: State<'_, BackendAppState>,
    model_id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(model_id);
    let body = axum::Json(routes::models::UpdateModelRequest { name, description });
    let json = routes::models::update_model(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_model(
    state: State<'_, BackendAppState>,
    model_id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(model_id);
    let json = routes::models::delete_model(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_add_field(
    state: State<'_, BackendAppState>,
    model_id: String,
    name: String,
    field_type: String,
    required: bool,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(model_id);
    let body = axum::Json(routes::models::AddFieldRequest {
        name,
        field_type,
        required,
    });
    let json = routes::models::add_field(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_field(
    state: State<'_, BackendAppState>,
    model_id: String,
    field_id: String,
    name: Option<String>,
    field_type: Option<String>,
    required: Option<bool>,
    unique: Option<bool>,
    description: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path((model_id, field_id));
    let body = axum::Json(routes::models::UpdateFieldRequest {
        name,
        field_type,
        required,
        unique,
        description,
    });
    let json = routes::models::update_field(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_field(
    state: State<'_, BackendAppState>,
    model_id: String,
    field_id: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path((model_id, field_id));
    let json = routes::models::delete_field(ax, path).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_add_relation(
    state: State<'_, BackendAppState>,
    model_id: String,
    name: String,
    target_model_id: String,
    relation_type: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(model_id);
    let body = axum::Json(routes::models::AddRelationRequest {
        name,
        target_model_id,
        relation_type,
    });
    let json = routes::models::add_relation(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_relation(
    state: State<'_, BackendAppState>,
    model_id: String,
    relation_id: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path((model_id, relation_id));
    let json = routes::models::delete_relation(ax, path).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

// ============================================================================
// ENDPOINTS
// ============================================================================

#[tauri::command]
pub async fn ipc_get_endpoints(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::endpoints::get_endpoints(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_add_endpoint(
    state: State<'_, BackendAppState>,
    method: String,
    path: String,
    name: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::endpoints::AddEndpointRequest { method, path, name });
    let json = routes::endpoints::add_endpoint(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_endpoint(
    state: State<'_, BackendAppState>,
    id: String,
    method: Option<String>,
    path: Option<String>,
    name: Option<String>,
    description: Option<String>,
    auth_required: Option<bool>,
    request_body: Option<Option<serde_json::Value>>,
    response_body: Option<Option<serde_json::Value>>,
    permissions: Option<Vec<String>>,
    logic_flow_id: Option<Option<String>>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path_ex = axum::extract::Path(id);

    // Convert serde_json::Value to DataShape
    let req_body = match request_body {
        Some(Some(v)) => Some(Some(serde_json::from_value(v).map_err(|e| format!("Invalid request_body: {}", e))?)),
        Some(None) => Some(None),
        None => None,
    };
    let resp_body = match response_body {
        Some(Some(v)) => Some(Some(serde_json::from_value(v).map_err(|e| format!("Invalid response_body: {}", e))?)),
        Some(None) => Some(None),
        None => None,
    };

    let body = axum::Json(routes::endpoints::UpdateEndpointRequest {
        method,
        path,
        name,
        description,
        auth_required,
        request_body: req_body,
        response_body: resp_body,
        permissions,
        logic_flow_id,
    });
    let json = routes::endpoints::update_endpoint(ax, path_ex, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_endpoint(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::endpoints::delete_endpoint(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// VARIABLES
// ============================================================================

#[tauri::command]
pub async fn ipc_get_variables(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::variables::get_variables(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_variable(
    state: State<'_, BackendAppState>,
    name: String,
    var_type: String,
    default_value: Option<serde_json::Value>,
    scope: Option<String>,
    page_id: Option<String>,
    description: Option<String>,
    persist: Option<bool>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::variables::CreateVariableRequest {
        name,
        var_type,
        default_value,
        scope,
        page_id,
        description,
        persist,
    });
    let json = routes::variables::create_variable(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_update_variable(
    state: State<'_, BackendAppState>,
    id: String,
    name: Option<String>,
    var_type: Option<String>,
    default_value: Option<serde_json::Value>,
    scope: Option<String>,
    page_id: Option<String>,
    description: Option<String>,
    persist: Option<bool>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let body = axum::Json(routes::variables::UpdateVariableRequest {
        name,
        var_type,
        default_value,
        scope,
        page_id,
        description,
        persist,
    });
    let json = routes::variables::update_variable(ax, path, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_variable(
    state: State<'_, BackendAppState>,
    id: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(id);
    let json = routes::variables::delete_variable(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// CODE GENERATION
// ============================================================================

#[tauri::command]
pub async fn ipc_generate_frontend(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::generate::generate_frontend(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_generate_backend(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::generate::generate_backend(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_generate_database(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::generate::generate_database(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_generate_zip(
    state: State<'_, BackendAppState>,
) -> Result<Vec<u8>, String> {
    // For ZIP we can't reuse the Axum handler directly because it returns IntoResponse.
    // Instead we inline the logic: get project → build zip buffer → return bytes.
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;

    crate::backend::routes::generate::build_zip_buffer(&project)
        .map_err(map_err)
}

#[tauri::command]
pub async fn ipc_generate_openapi(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::generate::generate_openapi(ax).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// DIAGRAMS
// ============================================================================

#[tauri::command]
pub async fn ipc_list_diagrams(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let json = routes::diagrams::list_diagrams(ax).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_diagram(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::diagrams::CreateDiagramRequest { name });
    let json = routes::diagrams::create_diagram(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_read_diagram(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<String, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(name);
    let json = routes::diagrams::read_diagram(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_save_diagram(
    state: State<'_, BackendAppState>,
    name: String,
    content: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(name);
    let body = axum::Json(routes::diagrams::SaveDiagramRequest { content });
    let json = routes::diagrams::save_diagram(ax, path, body).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_delete_diagram(
    state: State<'_, BackendAppState>,
    name: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let path = axum::extract::Path(name);
    let json = routes::diagrams::delete_diagram(ax, path).await.map_err(map_err)?;
    Ok(json.0)
}

// ============================================================================
// FILE SYSTEM
// ============================================================================

#[tauri::command]
pub async fn ipc_list_directory(
    state: State<'_, BackendAppState>,
    path: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let query = axum::extract::Query(routes::files::ListDirQuery { path });
    let json = routes::files::list_directory(ax, query).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_file(
    state: State<'_, BackendAppState>,
    path: String,
    content: Option<String>,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::files::CreateFileRequest { path, content });
    let json = routes::files::create_file(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_create_folder(
    state: State<'_, BackendAppState>,
    path: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::files::CreateFolderRequest { path });
    let json = routes::files::create_folder(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_rename_file(
    state: State<'_, BackendAppState>,
    old_path: String,
    new_path: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::files::RenameRequest {
        old_path,
        new_path,
    });
    let json = routes::files::rename_file(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_delete_file(
    state: State<'_, BackendAppState>,
    path: String,
) -> Result<bool, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::files::DeleteRequest { path });
    let json = routes::files::delete_file(ax, body).await.map_err(map_err)?;
    Ok(json.0)
}

#[tauri::command]
pub async fn ipc_read_file_content(
    state: State<'_, BackendAppState>,
    path: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let query = axum::extract::Query(routes::files::ReadFileQuery { path });
    let json = routes::files::read_file(ax, query).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_write_file_content(
    state: State<'_, BackendAppState>,
    path: String,
    content: String,
) -> Result<serde_json::Value, String> {
    let ax = axum::extract::State(state.inner().clone());
    let body = axum::Json(routes::files::WriteFileRequest { path, content });
    let json = routes::files::write_file(ax, body).await.map_err(map_err)?;
    serde_json::to_value(json.0).map_err(|e| e.to_string())
}

// ============================================================================
// GIT VERSION CONTROL
// ============================================================================

#[tauri::command]
pub async fn ipc_git_history(
    state: State<'_, BackendAppState>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    let commits = crate::backend::git::get_history(
        std::path::Path::new(root),
        limit.unwrap_or(50),
    )?;
    serde_json::to_value(commits).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_git_restore(
    state: State<'_, BackendAppState>,
    commit_id: String,
) -> Result<serde_json::Value, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    let info = crate::backend::git::restore_commit(std::path::Path::new(root), &commit_id)?;
    serde_json::to_value(info).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_git_diff(
    state: State<'_, BackendAppState>,
    commit_id: String,
) -> Result<String, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    crate::backend::git::get_diff(std::path::Path::new(root), &commit_id)
}

#[tauri::command]
pub async fn ipc_git_commit(
    state: State<'_, BackendAppState>,
    message: String,
) -> Result<serde_json::Value, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    let info = crate::backend::git::manual_commit(std::path::Path::new(root), &message)?;
    serde_json::to_value(info).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_git_init(
    state: State<'_, BackendAppState>,
) -> Result<bool, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    crate::backend::git::init_repo(std::path::Path::new(root))?;
    Ok(true)
}

#[tauri::command]
pub async fn ipc_git_status(
    state: State<'_, BackendAppState>,
) -> Result<serde_json::Value, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    let status = crate::backend::git::get_git_status(std::path::Path::new(root))?;
    serde_json::to_value(status).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ipc_git_discard_changes(
    state: State<'_, BackendAppState>,
    file_path: String,
) -> Result<(), String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    crate::backend::git::discard_changes(std::path::Path::new(root), &file_path)
}

#[tauri::command]
pub async fn ipc_git_get_file_content(
    state: State<'_, BackendAppState>,
    file_path: String,
    revision: String,
) -> Result<String, String> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| "No project loaded".to_string())?;
    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| "No project root path set".to_string())?;

    crate::backend::git::get_file_content(std::path::Path::new(root), &file_path, &revision)
}
