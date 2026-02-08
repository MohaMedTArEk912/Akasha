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
                settings_json TEXT NOT NULL,
                root_path TEXT
            )",
            [],
        )?;

        // Ensure root_path column exists for migrations (ignore error if it already exists)
        let _ = conn.execute("ALTER TABLE projects ADD COLUMN root_path TEXT", []);
        
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

        // App Settings table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Logic Flows table (migration — add if missing)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS logic_flows (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                flow_json TEXT NOT NULL,
                archived BOOLEAN NOT NULL DEFAULT 0,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )",
            [],
        )?;

        // Migration: add classes_json column to blocks (ignore error if exists)
        let _ = conn.execute("ALTER TABLE blocks ADD COLUMN classes_json TEXT DEFAULT '[]'", []);

        Ok(())
    }
    
    // ===== Workspace Settings =====

    pub fn get_workspace_path(&self) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = 'workspace_path'")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_workspace_path(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('workspace_path', ?1)",
            params![path],
        )?;
        Ok(())
    }
    
    // ===== Projects =====

    pub fn get_all_projects(&self) -> Result<Vec<ProjectSchema>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, created_at, updated_at, settings_json, root_path 
             FROM projects ORDER BY updated_at DESC"
        )?;
        
        let project_iter = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let settings_json: String = row.get(6)?;
            let settings: ProjectSettings = serde_json::from_str(&settings_json).unwrap_or_default();
            
            let created_at: chrono::DateTime<chrono::Utc> = row.get(4)?;
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(5)?;

            Ok(ProjectSchema {
                id,
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
                root_path: row.get(7)?,
            })
        })?;

        let mut projects = Vec::new();
        for p in project_iter {
            projects.push(p?);
        }
        Ok(projects)
    }
    
    pub fn get_project_by_id(&self, id: &str) -> Result<Option<ProjectSchema>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, created_at, updated_at, settings_json, root_path 
             FROM projects WHERE id = ?"
        )?;
        
        let mut project_iter = stmt.query_map([id], |row| {
            let settings_json: String = row.get(6)?;
            let settings: ProjectSettings = serde_json::from_str(&settings_json).unwrap_or_default();
            
            let created_at: chrono::DateTime<chrono::Utc> = row.get(4)?;
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(5)?;

            Ok(ProjectSchema {
                id: row.get(0)?,
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
                root_path: row.get(7)?,
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
                    physical_path: None,
                    version_hash: None,
                })
            })?;
            for p in pages { project.pages.push(p?); }
            
            // Load blocks
            let mut stmt = conn.prepare("SELECT id, project_id, page_id, parent_id, block_type, name, properties_json, styles_json, events_json, archived, block_order, classes_json FROM blocks WHERE project_id = ? AND archived = 0 ORDER BY block_order")?;
            let blocks = stmt.query_map([&project.id], |row| {
                let block_type_str: String = row.get(4)?;
                let block_type = match block_type_str.as_str() {
                    "Container" => BlockType::Container,
                    "Text" => BlockType::Text,
                    "Heading" => BlockType::Heading,
                    "Paragraph" => BlockType::Paragraph,
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
                    "Page" => BlockType::Page,
                    "Video" => BlockType::Video,
                    "Icon" => BlockType::Icon,
                    "TextArea" => BlockType::TextArea,
                    "Select" => BlockType::Select,
                    "Checkbox" => BlockType::Checkbox,
                    "Radio" => BlockType::Radio,
                    "Modal" => BlockType::Modal,
                    "Dropdown" => BlockType::Dropdown,
                    "Tabs" => BlockType::Tabs,
                    "Accordion" => BlockType::Accordion,
                    "List" => BlockType::List,
                    "Table" => BlockType::Table,
                    "Card" => BlockType::Card,
                    other => {
                        if let Some(name) = other.strip_prefix("Custom:") {
                            BlockType::Custom(name.to_string())
                        } else {
                            BlockType::Custom(other.to_string())
                        }
                    }
                };

                let classes_json: String = row.get::<_, String>(11).unwrap_or_else(|_| "[]".to_string());

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
                    classes: serde_json::from_str(&classes_json).unwrap_or_default(),
                    physical_path: None,
                    version_hash: None,
                })
            })?;
            for b in blocks { project.blocks.push(b?); }

            // Reconstruct children arrays from parent_id relationships
            let id_parent_pairs: Vec<(String, Option<String>)> = project.blocks.iter()
                .map(|b| (b.id.clone(), b.parent_id.clone()))
                .collect();
            for block in &mut project.blocks {
                block.children = id_parent_pairs.iter()
                    .filter(|(_, pid)| pid.as_deref() == Some(&block.id))
                    .map(|(id, _)| id.clone())
                    .collect();
            }
            
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

            // Load Data Models
            let mut stmt = conn.prepare("SELECT id, name, fields_json, relations_json, archived FROM models WHERE project_id = ? AND archived = 0")?;
            let models = stmt.query_map([&project.id], |row| {
                let fields: Vec<crate::schema::data_model::FieldSchema> =
                    serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default();
                let relations: Vec<crate::schema::data_model::RelationSchema> =
                    serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default();

                Ok(crate::schema::DataModelSchema {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: None,
                    fields,
                    relations,
                    indexes: Vec::new(),
                    timestamps: true,
                    soft_delete: false,
                    archived: row.get(4)?,
                })
            })?;
            for m in models { project.data_models.push(m?); }

            // Load Logic Flows
            let mut stmt = conn.prepare("SELECT id, name, description, flow_json, archived FROM logic_flows WHERE project_id = ? AND archived = 0")?;
            let flows = stmt.query_map([&project.id], |row| {
                let flow_json: String = row.get(3)?;
                // Try to deserialize the full flow, fall back to a minimal struct
                let mut flow: crate::schema::logic_flow::LogicFlowSchema =
                    serde_json::from_str(&flow_json).unwrap_or_else(|_| {
                        crate::schema::logic_flow::LogicFlowSchema {
                            id: row.get(0).unwrap_or_default(),
                            name: row.get(1).unwrap_or_default(),
                            description: None,
                            trigger: crate::schema::logic_flow::TriggerType::Manual,
                            nodes: Vec::new(),
                            entry_node_id: None,
                            context: crate::schema::logic_flow::FlowContext::Frontend,
                            archived: false,
                        }
                    });
                flow.id = row.get(0)?;
                flow.name = row.get(1)?;
                flow.description = row.get(2)?;
                flow.archived = row.get(4)?;
                Ok(flow)
            })?;
            for f in flows { project.logic_flows.push(f?); }

            Ok(Some(project))
        } else {
            Ok(None)
        }
    }
    
    pub fn save_project(&self, project: &ProjectSchema) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Upsert Project
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, description, version, created_at, updated_at, settings_json, root_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project.id,
                project.name,
                project.description,
                project.version,
                project.created_at,
                project.updated_at,
                serde_json::to_string(&project.settings).unwrap(),
                project.root_path
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
        
        // Build a map: block_id -> page_id for proper page association
        let mut block_page_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        for page in &project.pages {
            if let Some(root_id) = &page.root_block_id {
                // Walk the block tree from root to assign page_id
                let mut stack = vec![root_id.clone()];
                while let Some(bid) = stack.pop() {
                    block_page_map.insert(bid.clone(), page.id.clone());
                    if let Some(block) = project.blocks.iter().find(|b| b.id == bid) {
                        for child_id in &block.children {
                            stack.push(child_id.clone());
                        }
                    }
                }
            }
        }

        // Upsert Blocks
        for (idx, block) in project.blocks.iter().enumerate() {
            let block_type_str = match &block.block_type {
                BlockType::Page => "Page",
                BlockType::Container => "Container",
                BlockType::Section => "Section",
                BlockType::Columns => "Columns",
                BlockType::Column => "Column",
                BlockType::Flex => "Flex",
                BlockType::Grid => "Grid",
                BlockType::Text => "Text",
                BlockType::Heading => "Heading",
                BlockType::Paragraph => "Paragraph",
                BlockType::Link => "Link",
                BlockType::Image => "Image",
                BlockType::Video => "Video",
                BlockType::Icon => "Icon",
                BlockType::Form => "Form",
                BlockType::Input => "Input",
                BlockType::TextArea => "TextArea",
                BlockType::Select => "Select",
                BlockType::Checkbox => "Checkbox",
                BlockType::Radio => "Radio",
                BlockType::Button => "Button",
                BlockType::Modal => "Modal",
                BlockType::Dropdown => "Dropdown",
                BlockType::Tabs => "Tabs",
                BlockType::Accordion => "Accordion",
                BlockType::List => "List",
                BlockType::Table => "Table",
                BlockType::Card => "Card",
                BlockType::Custom(name) => name.as_str(),
            };
            let page_id = block_page_map.get(&block.id).cloned();
            conn.execute(
                "INSERT OR REPLACE INTO blocks (id, project_id, page_id, parent_id, block_type, name, properties_json, styles_json, events_json, archived, block_order, classes_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                 params![
                     block.id,
                     project.id,
                     page_id,
                     block.parent_id,
                     block_type_str,
                     block.name,
                     serde_json::to_string(&block.properties).unwrap(),
                     serde_json::to_string(&block.styles).unwrap(),
                     serde_json::to_string(&block.events).unwrap(),
                     block.archived,
                     idx as i32,
                     serde_json::to_string(&block.classes).unwrap()
                 ]
            )?;
        }
        
        // Upsert APIs
        for api in &project.apis {
            let method_str = match api.method {
                HttpMethod::Get => "GET",
                HttpMethod::Post => "POST",
                HttpMethod::Put => "PUT",
                HttpMethod::Patch => "PATCH",
                HttpMethod::Delete => "DELETE",
            };
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

        // Upsert Data Models
        for model in &project.data_models {
            conn.execute(
                "INSERT OR REPLACE INTO models (id, project_id, name, fields_json, relations_json, archived)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                 params![
                     model.id,
                     project.id,
                     model.name,
                     serde_json::to_string(&model.fields).unwrap(),
                     serde_json::to_string(&model.relations).unwrap(),
                     model.archived
                 ]
            )?;
        }

        // Upsert Logic Flows
        for flow in &project.logic_flows {
            let flow_json = serde_json::to_string(flow).unwrap();
            conn.execute(
                "INSERT OR REPLACE INTO logic_flows (id, project_id, name, description, flow_json, archived)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                 params![
                     flow.id,
                     project.id,
                     flow.name,
                     flow.description,
                     flow_json,
                     flow.archived
                 ]
            )?;
        }

        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Delete related data first
        conn.execute("DELETE FROM blocks WHERE project_id = ?", [id])?;
        conn.execute("DELETE FROM pages WHERE project_id = ?", [id])?;
        conn.execute("DELETE FROM apis WHERE project_id = ?", [id])?;
        conn.execute("DELETE FROM models WHERE project_id = ?", [id])?;
        conn.execute("DELETE FROM logic_flows WHERE project_id = ?", [id])?;
        
        // Delete project
        conn.execute("DELETE FROM projects WHERE id = ?", [id])?;
        
        Ok(())
    }
}
