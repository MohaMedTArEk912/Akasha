//! Grapes IDE - Desktop Visual Full-Stack Builder
//! 
//! This is the Rust core engine for Grapes IDE. It handles:
//! - Schema management (the source of truth)
//! - Command execution (all mutations)
//! - Virtual File System
//! - Code generation
//! - Local storage (SQLite)

use std::sync::Mutex;
use tauri::State;

// Module declarations
pub mod schema;
pub mod commands;
pub mod vfs;
pub mod generator;
pub mod storage;
pub mod backend; // Backend API server

// Re-exports
pub use schema::ProjectSchema;

/// Application state - holds the current project
pub struct AppState {
    /// Current project (None if no project is open)
    pub project: Mutex<Option<ProjectSchema>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            project: Mutex::new(None),
        }
    }
}

// ============================================================================
// TAURI COMMANDS - IPC Handlers
// ============================================================================

/// Create a new project
#[tauri::command]
fn create_project(
    state: State<AppState>,
    name: String,
) -> Result<ProjectSchema, String> {
    let project_id = uuid::Uuid::new_v4().to_string();
    let project = ProjectSchema::new(project_id, name);
    
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    *state_lock = Some(project.clone());
    
    log::info!("Created new project: {}", project.name);
    Ok(project)
}

/// Get the current project
#[tauri::command]
fn get_project(state: State<AppState>) -> Result<Option<ProjectSchema>, String> {
    let state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    Ok(state_lock.clone())
}

/// Save project to JSON string
#[tauri::command]
fn export_project_json(state: State<AppState>) -> Result<String, String> {
    let state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    
    match state_lock.as_ref() {
        Some(project) => project.to_json().map_err(|e| e.to_string()),
        None => Err("No project open".into()),
    }
}

/// Load project from JSON string
#[tauri::command]
fn import_project_json(
    state: State<AppState>,
    json: String,
) -> Result<ProjectSchema, String> {
    let project = ProjectSchema::from_json(&json).map_err(|e| e.to_string())?;
    
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    *state_lock = Some(project.clone());
    
    log::info!("Imported project: {}", project.name);
    Ok(project)
}

/// Add a block to the project
#[tauri::command]
fn add_block(
    state: State<AppState>,
    block_type: String,
    name: String,
    parent_id: Option<String>,
) -> Result<schema::BlockSchema, String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let block_type_enum = parse_block_type(&block_type)?;
    let block_id = uuid::Uuid::new_v4().to_string();
    
    let mut block = schema::BlockSchema::new(&block_id, block_type_enum, name);
    
    if let Some(pid) = parent_id {
        block.parent_id = Some(pid.clone());
        
        // Add this block as child of parent
        if let Some(parent) = project.find_block_mut(&pid) {
            parent.children.push(block_id.clone());
        }
    }
    
    let block_clone = block.clone();
    project.add_block(block);
    
    log::info!("Added block: {}", block_clone.id);
    Ok(block_clone)
}

/// Update a block property
#[tauri::command]
fn update_block_property(
    state: State<AppState>,
    block_id: String,
    property: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let block = project.find_block_mut(&block_id).ok_or("Block not found")?;
    block.properties.insert(property, value);
    project.touch();
    
    Ok(())
}

/// Update a block style
#[tauri::command]
fn update_block_style(
    state: State<AppState>,
    block_id: String,
    style: String,
    value: String,
) -> Result<(), String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let block = project.find_block_mut(&block_id).ok_or("Block not found")?;
    block.styles.insert(style, schema::StyleValue::String(value));
    project.touch();
    
    Ok(())
}

/// Archive a block (soft delete)
#[tauri::command]
fn archive_block(
    state: State<AppState>,
    block_id: String,
) -> Result<bool, String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let result = project.archive_block(&block_id);
    log::info!("Archived block: {} (success: {})", block_id, result);
    Ok(result)
}

/// Add a page to the project
#[tauri::command]
fn add_page(
    state: State<AppState>,
    name: String,
    path: String,
) -> Result<schema::PageSchema, String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let page_id = uuid::Uuid::new_v4().to_string();
    let page = schema::PageSchema::new(&page_id, name, path);
    
    let page_clone = page.clone();
    project.add_page(page);
    
    log::info!("Added page: {}", page_clone.name);
    Ok(page_clone)
}

/// Add a data model to the project
#[tauri::command]
fn add_data_model(
    state: State<AppState>,
    name: String,
) -> Result<schema::DataModelSchema, String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let model_id = uuid::Uuid::new_v4().to_string();
    let model = schema::DataModelSchema::new(&model_id, name);
    
    let model_clone = model.clone();
    project.add_data_model(model);
    
    log::info!("Added data model: {}", model_clone.name);
    Ok(model_clone)
}

/// Add an API endpoint to the project
#[tauri::command]
fn add_api(
    state: State<AppState>,
    method: String,
    path: String,
    name: String,
) -> Result<schema::ApiSchema, String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let api_id = uuid::Uuid::new_v4().to_string();
    let http_method = parse_http_method(&method)?;
    let api = schema::ApiSchema::new(&api_id, http_method, path, name);
    
    let api_clone = api.clone();
    project.add_api(api);
    
    log::info!("Added API: {} {}", method, api_clone.path);
    Ok(api_clone)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Parse block type string to enum
fn parse_block_type(s: &str) -> Result<schema::BlockType, String> {
    match s.to_lowercase().as_str() {
        "page" => Ok(schema::BlockType::Page),
        "container" => Ok(schema::BlockType::Container),
        "section" => Ok(schema::BlockType::Section),
        "columns" => Ok(schema::BlockType::Columns),
        "column" => Ok(schema::BlockType::Column),
        "flex" => Ok(schema::BlockType::Flex),
        "grid" => Ok(schema::BlockType::Grid),
        "text" => Ok(schema::BlockType::Text),
        "heading" => Ok(schema::BlockType::Heading),
        "paragraph" => Ok(schema::BlockType::Paragraph),
        "link" => Ok(schema::BlockType::Link),
        "image" => Ok(schema::BlockType::Image),
        "video" => Ok(schema::BlockType::Video),
        "icon" => Ok(schema::BlockType::Icon),
        "form" => Ok(schema::BlockType::Form),
        "input" => Ok(schema::BlockType::Input),
        "textarea" => Ok(schema::BlockType::TextArea),
        "select" => Ok(schema::BlockType::Select),
        "checkbox" => Ok(schema::BlockType::Checkbox),
        "radio" => Ok(schema::BlockType::Radio),
        "button" => Ok(schema::BlockType::Button),
        "modal" => Ok(schema::BlockType::Modal),
        "dropdown" => Ok(schema::BlockType::Dropdown),
        "tabs" => Ok(schema::BlockType::Tabs),
        "accordion" => Ok(schema::BlockType::Accordion),
        "list" => Ok(schema::BlockType::List),
        "table" => Ok(schema::BlockType::Table),
        "card" => Ok(schema::BlockType::Card),
        _ => Err(format!("Unknown block type: {}", s)),
    }
}

/// Parse HTTP method string to enum
fn parse_http_method(s: &str) -> Result<schema::HttpMethod, String> {
    match s.to_uppercase().as_str() {
        "GET" => Ok(schema::HttpMethod::Get),
        "POST" => Ok(schema::HttpMethod::Post),
        "PUT" => Ok(schema::HttpMethod::Put),
        "PATCH" => Ok(schema::HttpMethod::Patch),
        "DELETE" => Ok(schema::HttpMethod::Delete),
        _ => Err(format!("Unknown HTTP method: {}", s)),
    }
}

// ============================================================================
// TAURI ENTRY POINT
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();
    
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Project commands
            create_project,
            get_project,
            export_project_json,
            import_project_json,
            // Block commands
            add_block,
            update_block_property,
            update_block_style,
            archive_block,
            // Page commands
            add_page,
            // Data model commands
            add_data_model,
            // API commands
            add_api,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
