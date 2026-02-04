//! Database module - SQLite persistence layer

use rusqlite::{Connection, Result, params};
use std::sync::{Arc, Mutex};
use crate::schema::{
    ProjectSchema, BlockSchema, PageSchema, ApiSchema,
    project::ProjectSettings, BlockType, HttpMethod
};

/// Database connection pool wrapper (simple mutex for SQLite)
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Initialize database connection and migrations
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        // Apply migrations
        Self::migrate(&conn)?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// Create tables
    fn migrate(conn: &Connection) -> Result<()> {
        // Projects table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                settings_json TEXT NOT NULL
            )",
            [],
        )?;
        
        // Pages table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pages (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                root_block_id TEXT,
                archived BOOLEAN NOT NULL DEFAULT 0,
                meta_json TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )",
            [],
        )?;
        
        // Blocks table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS blocks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                page_id TEXT,
                parent_id TEXT,
                block_type TEXT NOT NULL,
                name TEXT NOT NULL,
                properties_json TEXT NOT NULL,
                styles_json TEXT NOT NULL,
                events_json TEXT NOT NULL,
                archived BOOLEAN NOT NULL DEFAULT 0,
                block_order INTEGER NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )",
            [],
        )?;

        // APIs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS apis (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                logic_flow_id TEXT,
                archived BOOLEAN NOT NULL DEFAULT 0,
                meta_json TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )",
            [],
        )?;
        
        // Data Models table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                fields_json TEXT NOT NULL,
                relations_json TEXT NOT NULL,
                archived BOOLEAN NOT NULL DEFAULT 0,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )",
            [],
        )?;
        
        Ok(())
    }
    
    // ===== Projects =====
    
    pub fn get_project(&self) -> Result<Option<ProjectSchema>> {
        let conn = self.conn.lock().unwrap();
        
        // Get the most recent project (single project mode for now)
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, created_at, updated_at, settings_json 
             FROM projects ORDER BY updated_at DESC LIMIT 1"
        )?;
        
        let mut project_iter = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let settings_json: String = row.get(6)?;
            let settings: ProjectSettings = serde_json::from_str(&settings_json).unwrap_or_default();
            
            let created_at: chrono::DateTime<chrono::Utc> = row.get(4)?;
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(5)?;

            Ok(ProjectSchema {
                id: id.clone(),
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                created_at,
                updated_at,
                settings,
                blocks: Vec::new(),
                pages: Vec::new(),
                apis: Vec::new(),
                logic_flows: Vec::new(),
                data_models: Vec::new(),
                variables: Vec::new(),
            })
        })?;
        
        if let Some(project_res) = project_iter.next() {
            let mut project = project_res?;
            
            // Load pages
            let mut stmt = conn.prepare("SELECT * FROM pages WHERE project_id = ? AND archived = 0")?;
            let pages = stmt.query_map([&project.id], |row| {
                Ok(PageSchema {
                    id: row.get(0)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    root_block_id: row.get(4)?,
                    archived: row.get(5)?,
                    meta: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
                })
            })?;
            for p in pages { project.pages.push(p?); }
            
            // Load blocks
            let mut stmt = conn.prepare("SELECT * FROM blocks WHERE project_id = ? AND archived = 0 ORDER BY block_order")?;
            let blocks = stmt.query_map([&project.id], |row| {
                let block_type_str: String = row.get(4)?;
                let block_type = match block_type_str.as_str() {
                    "Container" => BlockType::Container,
                    "Text" => BlockType::Text,
                    "Heading" => BlockType::Heading,
                    "Button" => BlockType::Button,
                    "Image" => BlockType::Image,
                    "Input" => BlockType::Input,
                    "Form" => BlockType::Form,
                    "Link" => BlockType::Link,
                    "Section" => BlockType::Section,
                    "Columns" => BlockType::Columns,
                    "Column" => BlockType::Column,
                    "Flex" => BlockType::Flex,
                    "Grid" => BlockType::Grid,
                    _ => BlockType::Container // Fallback
                };
                
                Ok(BlockSchema {
                    id: row.get(0)?,
                    parent_id: row.get(3)?,
                    block_type, 
                    name: row.get(5)?,
                    properties: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
                    styles: serde_json::from_str(&row.get::<_, String>(7)?).unwrap_or_default(),
                    events: serde_json::from_str(&row.get::<_, String>(8)?).unwrap_or_default(),
                    archived: row.get(9)?,
                    order: row.get(10)?,
                    children: Vec::new(),
                    responsive_styles: std::collections::HashMap::new(),
                    classes: Vec::new(),
                })
            })?;
            for b in blocks { project.blocks.push(b?); }
            
            // Load APIs
            let mut stmt = conn.prepare("SELECT * FROM apis WHERE project_id = ? AND archived = 0")?;
            let apis = stmt.query_map([&project.id], |row| {
                let method_str: String = row.get(2)?;
                let method = match method_str.as_str() {
                    "POST" => HttpMethod::Post,
                    "PUT" => HttpMethod::Put,
                    "DELETE" => HttpMethod::Delete,
                    "PATCH" => HttpMethod::Patch,
                    _ => HttpMethod::Get,
                };
                
                Ok(ApiSchema {
                    id: row.get(0)?,
                    method,
                    path: row.get(3)?,
                    name: row.get(4)?,
                    description: row.get(5)?,
                    logic_flow_id: row.get(6)?,
                    archived: row.get(7)?,
                    permissions: Vec::new(), 
                    request_body: None,
                    response_body: None,
                    query_params: Vec::new(),
                    path_params: Vec::new(),
                    rate_limit: None,
                })
            })?;
            for a in apis { project.apis.push(a?); }
            
            Ok(Some(project))
        } else {
            Ok(None)
        }
    }
    
    pub fn save_project(&self, project: &ProjectSchema) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Upsert Project
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, description, version, created_at, updated_at, settings_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project.id,
                project.name,
                project.description,
                project.version,
                project.created_at,
                project.updated_at,
                serde_json::to_string(&project.settings).unwrap()
            ],
        )?;
        
        // Upsert Pages
        for page in &project.pages {
            conn.execute(
                "INSERT OR REPLACE INTO pages (id, project_id, name, path, root_block_id, archived, meta_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                 params![
                     page.id,
                     project.id,
                     page.name,
                     page.path,
                     page.root_block_id,
                     page.archived,
                     serde_json::to_string(&page.meta).unwrap()
                 ]
            )?;
        }
        
        // Upsert Blocks
        for (idx, block) in project.blocks.iter().enumerate() {
            let block_type_str = format!("{:?}", block.block_type); 
            conn.execute(
                "INSERT OR REPLACE INTO blocks (id, project_id, page_id, parent_id, block_type, name, properties_json, styles_json, events_json, archived, block_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                 params![
                     block.id,
                     project.id,
                     None::<String>,
                     block.parent_id,
                     block_type_str,
                     block.name,
                     serde_json::to_string(&block.properties).unwrap(),
                     serde_json::to_string(&block.styles).unwrap(),
                     serde_json::to_string(&block.events).unwrap(),
                     block.archived,
                     idx as i32
                 ]
            )?;
        }
        
        // Upsert APIs
        for api in &project.apis {
            let method_str = format!("{:?}", api.method).to_uppercase();
            conn.execute(
                "INSERT OR REPLACE INTO apis (id, project_id, method, path, name, description, logic_flow_id, archived, meta_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                 params![
                     api.id,
                     project.id,
                     method_str,
                     api.path,
                     api.name,
                     api.description,
                     api.logic_flow_id,
                     api.archived,
                     "{}" 
                 ]
            )?;
        }
        
        Ok(())
    }
}
