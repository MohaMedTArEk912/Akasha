//! Grapes IDE - Desktop Visual Full-Stack Builder
//! 
//! This is the Rust core engine for Grapes IDE. It handles:
//! - Schema management (the source of truth)
//! - Command execution (all mutations)
//! - Virtual File System
//! - Code generation
//! - Local storage (SQLite)

use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::net::TcpListener;

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
    /// Active development process
    pub dev_process: Mutex<Option<std::process::Child>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            project: Mutex::new(None),
            dev_process: Mutex::new(None),
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
    
    // Auto-sync to disk if root path is set
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        if let Err(e) = engine.sync_page_to_disk_by_block(&block_id, project) {
            log::error!("Auto-sync failed for block {}: {}", block_id, e);
        }
    }

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
    block.styles.insert(style, crate::schema::block::StyleValue::String(value));
    project.touch();

    // Auto-sync to disk if root path is set
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        if let Err(e) = engine.sync_page_to_disk_by_block(&block_id, project) {
            log::error!("Auto-sync failed for block {}: {}", block_id, e);
        }
    }
    
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
    project.touch();
    
    // Auto-sync to disk if root path is set
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        if let Err(e) = engine.sync_page_to_disk(&page_clone.id, project) {
            log::error!("Auto-sync failed for page {}: {}", page_clone.id, e);
        }
    }
    
    log::info!("Added page: {}", page_clone.id);
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

/// Set the physical path for the project root
#[tauri::command]
fn set_project_root(
    state: State<AppState>,
    path: String,
) -> Result<(), String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    project.root_path = Some(path.clone());
    
    // Initialize structure
    let engine = crate::generator::sync_engine::SyncEngine::new(path);
    engine.init_project_structure(project).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Manually trigger a full sync to disk
#[tauri::command]
fn sync_to_disk(
    state: State<AppState>,
) -> Result<(), String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let root = project.root_path.as_ref().ok_or("No root path set")?;
    let engine = crate::generator::sync_engine::SyncEngine::new(root);
    
    // Sync all pages
    for page in &project.pages {
        if !page.archived {
            engine.sync_page_to_disk(&page.id, project).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

/// Sync changes from disk back to the project schema
#[tauri::command]
fn sync_disk_to_project(
    state: State<AppState>,
) -> Result<(), String> {
    let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = state_lock.as_mut().ok_or("No project open")?;
    
    let root = project.root_path.as_ref().ok_or("No root path set")?;
    let engine = crate::generator::sync_engine::SyncEngine::new(root);
    
    engine.sync_disk_to_project(project).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Spawn the development server (npm run dev)
#[tauri::command]
fn start_dev_server(
    state: State<AppState>,
) -> Result<u32, String> {
    let project_lock = state.project.lock().map_err(|_| "Lock failed")?;
    let project = project_lock.as_ref().ok_or("No project open")?;
    let root = project.root_path.as_ref().ok_or("No root path set")?;
    
    // Check if process already running
    let mut dev_lock = state.dev_process.lock().map_err(|_| "Lock failed")?;
    if let Some(mut child) = dev_lock.take() {
        let _ = child.kill();
    }
    
    log::info!("Starting dev server in: {}", root);
    
    // On Windows, we often need to run cmd /C npm
    let child = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", "npm", "run", "dev"])
            .current_dir(root)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
    } else {
        std::process::Command::new("npm")
            .arg("run")
            .arg("dev")
            .current_dir(root)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
    }.map_err(|e| format!("Failed to start dev server: {}", e))?;
        
    let pid = child.id();
    *dev_lock = Some(child);
    
    Ok(pid)
}

/// Install npm dependencies in the project root
#[tauri::command]
async fn install_dependencies(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let root = {
        let project_lock = state.project.lock().map_err(|_| "Lock failed")?;
        let project = project_lock.as_ref().ok_or("No project open")?;
        project.root_path.as_ref().ok_or("No root path set")?.clone()
    };

    log::info!("Installing dependencies in: {}", root);

    // Run npm install with a timeout to avoid hanging forever
    let mut command = if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "npm", "install", "--no-audit", "--no-fund"]);
        cmd
    } else {
        let mut cmd = std::process::Command::new("npm");
        cmd.arg("install").arg("--no-audit").arg("--no-fund");
        cmd
    };

    let mut child = command
        .current_dir(&root)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to run npm install: {}", e))?;

    let start = Instant::now();
    let timeout = Duration::from_secs(300);

    loop {
        if let Some(status) = child.try_wait().map_err(|e| format!("Failed to check npm install status: {}", e))? {
            if status.success() {
                log::info!("npm install completed successfully");
                return Ok("Dependencies installed successfully".to_string());
            }

            log::error!("npm install failed with status: {}", status);
            return Err(format!("npm install failed with status: {}", status));
        }

        if start.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            log::error!("npm install timed out after {} seconds", timeout.as_secs());
            return Err(format!("npm install timed out after {} seconds", timeout.as_secs()));
        }

        // Use async sleep to avoid blocking the Tokio runtime
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// Stop the development server
#[tauri::command]
fn stop_dev_server(
    state: State<AppState>,
) -> Result<(), String> {
    let mut dev_lock = state.dev_process.lock().map_err(|_| "Lock failed")?;
    if let Some(mut child) = dev_lock.take() {
        child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
        log::info!("Stopped dev server");
    }
    Ok(())
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

fn backend_bind_addr() -> String {
    if let Ok(bind) = std::env::var("GRAPES_BIND") {
        let trimmed = bind.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3001);

    format!("0.0.0.0:{port}")
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};

        if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
            sigterm.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    let _ = env_logger::try_init();
    
    // Start Embedded Backend API Server (Axum)
    // This provides the REST API that the frontend uses on port 3001
    log::info!("Starting embedded API server...");
    
    let backend_state = match crate::backend::BackendAppState::new() {
        Ok(state) => state,
        Err(e) => {
            log::error!("Failed to initialize backend state: {}", e);
            return;
        }
    };
    
    let router = crate::backend::create_router(backend_state);
    let addr = backend_bind_addr();
    
    // Spawn server in a background task
    tauri::async_runtime::spawn(async move {
        match TcpListener::bind(&addr).await {
            Ok(listener) => {
                log::info!("Backend API server listening on http://{}", addr);
                if let Err(e) = axum::serve(listener, router).await {
                    log::error!("Axum server error: {}", e);
                }
            }
            Err(e) => {
                log::error!("Failed to bind to {}: {}", addr, e);
            }
        }
    });
    
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
            // Sync commands
            set_project_root,
            sync_to_disk,
            sync_disk_to_project,
            // Terminal commands
            start_dev_server,
            stop_dev_server,
            install_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run_headless() -> anyhow::Result<()> {
    let _ = env_logger::try_init();
    log::info!("Starting headless API server...");

    let backend_state = crate::backend::BackendAppState::new()?;
    let router = crate::backend::create_router(backend_state);

    let addr = backend_bind_addr();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async move {
            let listener = TcpListener::bind(&addr).await?;
            log::info!("Backend API server listening on http://{}", addr);

            axum::serve(listener, router)
                .with_graceful_shutdown(shutdown_signal())
                .await?;

            Ok(())
        })
}
