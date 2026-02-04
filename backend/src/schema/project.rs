//! Project Schema - Master schema that ties everything together
//! 
//! The ProjectSchema is the single source of truth for an entire project.
//! It contains all blocks, pages, APIs, data models, logic flows, and variables.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{
    BlockSchema, ApiSchema, DataModelSchema, LogicFlowSchema, 
    VariableSchema, PageSchema
};

/// The master project schema - contains the entire project state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSchema {
    /// Schema version for migrations
    pub version: String,
    
    /// Unique project identifier (UUID v4)
    pub id: String,
    
    /// Project name
    pub name: String,
    
    /// Project description
    pub description: Option<String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    
    // ===== Frontend =====
    
    /// All UI blocks in the project
    pub blocks: Vec<BlockSchema>,
    
    /// All pages in the project
    pub pages: Vec<PageSchema>,
    
    // ===== Backend =====
    
    /// All API endpoints
    pub apis: Vec<ApiSchema>,
    
    /// All logic flows (event handlers, API handlers)
    pub logic_flows: Vec<LogicFlowSchema>,
    
    // ===== Database =====
    
    /// All data models (database tables)
    pub data_models: Vec<DataModelSchema>,
    
    // ===== State =====
    
    /// All state variables
    pub variables: Vec<VariableSchema>,
    
    // ===== Project Settings =====
    
    /// Project-wide settings
    pub settings: ProjectSettings,
}

/// Project-wide settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    /// Default locale
    pub default_locale: String,
    
    /// Supported locales
    pub locales: Vec<String>,
    
    /// Theme configuration
    pub theme: ThemeSettings,
    
    /// Build configuration
    pub build: BuildSettings,
    
    /// SEO defaults
    pub seo: SeoSettings,
}

/// Theme settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSettings {
    /// Primary color (hex)
    pub primary_color: String,
    
    /// Secondary color (hex)
    pub secondary_color: String,
    
    /// Font family
    pub font_family: String,
    
    /// Border radius (px)
    pub border_radius: u8,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            primary_color: "#6366f1".into(),
            secondary_color: "#8b5cf6".into(),
            font_family: "Inter".into(),
            border_radius: 8,
        }
    }
}

/// Build settings for code generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildSettings {
    /// Frontend framework to generate
    pub frontend_framework: FrontendFramework,
    
    /// Backend framework to generate
    pub backend_framework: BackendFramework,
    
    /// Database provider
    pub database_provider: DatabaseProvider,
    
    /// Whether to use TypeScript
    pub typescript: bool,
}

impl Default for BuildSettings {
    fn default() -> Self {
        Self {
            frontend_framework: FrontendFramework::React,
            backend_framework: BackendFramework::NestJs,
            database_provider: DatabaseProvider::PostgreSql,
            typescript: true,
        }
    }
}

/// Frontend framework options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FrontendFramework {
    React,
    NextJs,
    Vue,
    Svelte,
}

/// Backend framework options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackendFramework {
    Express,
    NestJs,
    Fastify,
}

/// Database provider options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseProvider {
    PostgreSql,
    MySql,
    Sqlite,
    MongoDb,
}

/// SEO default settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeoSettings {
    /// Default page title suffix
    pub title_suffix: Option<String>,
    
    /// Default meta description
    pub default_description: Option<String>,
    
    /// Default OpenGraph image
    pub default_og_image: Option<String>,
    
    /// Favicon URL
    pub favicon: Option<String>,
}

impl Default for SeoSettings {
    fn default() -> Self {
        Self {
            title_suffix: None,
            default_description: None,
            default_og_image: None,
            favicon: None,
        }
    }
}

impl ProjectSchema {
    /// Current schema version
    pub const CURRENT_VERSION: &'static str = "1.0.0";
    
    /// Create a new empty project
    /// 
    /// # Arguments
    /// * `id` - Unique project identifier
    /// * `name` - Project name
    /// 
    /// # Returns
    /// A new ProjectSchema with default settings and an initial home page
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        let id_str = id.into();
        let now = Utc::now();
        
        // Create default home page
        let home_page = PageSchema::new(
            format!("{}-home", &id_str),
            "Home",
            "/"
        );
        
        Self {
            version: Self::CURRENT_VERSION.into(),
            id: id_str,
            name: name.into(),
            description: None,
            created_at: now,
            updated_at: now,
            blocks: Vec::new(),
            pages: vec![home_page],
            apis: Vec::new(),
            logic_flows: Vec::new(),
            data_models: Vec::new(),
            variables: Vec::new(),
            settings: ProjectSettings::default(),
        }
    }
    
    /// Update the timestamp
    pub fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
    
    /// Add a block to the project
    pub fn add_block(&mut self, block: BlockSchema) {
        self.blocks.push(block);
        self.touch();
    }
    
    /// Add a page to the project
    pub fn add_page(&mut self, page: PageSchema) {
        self.pages.push(page);
        self.touch();
    }
    
    /// Add an API endpoint
    pub fn add_api(&mut self, api: ApiSchema) {
        self.apis.push(api);
        self.touch();
    }
    
    /// Add a logic flow
    pub fn add_logic_flow(&mut self, flow: LogicFlowSchema) {
        self.logic_flows.push(flow);
        self.touch();
    }
    
    /// Add a data model
    pub fn add_data_model(&mut self, model: DataModelSchema) {
        self.data_models.push(model);
        self.touch();
    }
    
    /// Add a variable
    pub fn add_variable(&mut self, variable: VariableSchema) {
        self.variables.push(variable);
        self.touch();
    }
    
    /// Find a block by ID
    pub fn find_block(&self, id: &str) -> Option<&BlockSchema> {
        self.blocks.iter().find(|b| b.id == id && !b.archived)
    }
    
    /// Find a block by ID (mutable)
    pub fn find_block_mut(&mut self, id: &str) -> Option<&mut BlockSchema> {
        self.blocks.iter_mut().find(|b| b.id == id && !b.archived)
    }
    
    /// Find a page by ID
    pub fn find_page(&self, id: &str) -> Option<&PageSchema> {
        self.pages.iter().find(|p| p.id == id && !p.archived)
    }
    
    /// Find an API by ID
    pub fn find_api(&self, id: &str) -> Option<&ApiSchema> {
        self.apis.iter().find(|a| a.id == id && !a.archived)
    }
    
    /// Find a data model by ID
    pub fn find_model(&self, id: &str) -> Option<&DataModelSchema> {
        self.data_models.iter().find(|m| m.id == id && !m.archived)
    }
    
    /// Find a logic flow by ID
    pub fn find_flow(&self, id: &str) -> Option<&LogicFlowSchema> {
        self.logic_flows.iter().find(|f| f.id == id && !f.archived)
    }
    
    /// Find a variable by ID
    pub fn find_variable(&self, id: &str) -> Option<&VariableSchema> {
        self.variables.iter().find(|v| v.id == id && !v.archived)
    }
    
    /// Archive an entity by ID (soft delete)
    pub fn archive_block(&mut self, id: &str) -> bool {
        if let Some(block) = self.blocks.iter_mut().find(|b| b.id == id) {
            block.archived = true;
            self.touch();
            return true;
        }
        false
    }
    
    /// Serialize to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
    
    /// Deserialize from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            default_locale: "en".into(),
            locales: vec!["en".into()],
            theme: ThemeSettings::default(),
            build: BuildSettings::default(),
            seo: SeoSettings::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_project() {
        let project = ProjectSchema::new("proj-1", "My App");
        assert_eq!(project.id, "proj-1");
        assert_eq!(project.name, "My App");
        assert_eq!(project.version, ProjectSchema::CURRENT_VERSION);
        // Should have default home page
        assert_eq!(project.pages.len(), 1);
        assert_eq!(project.pages[0].path, "/");
    }
    
    #[test]
    fn test_add_and_find() {
        use crate::schema::BlockType;
        
        let mut project = ProjectSchema::new("proj-2", "Test");
        
        let block = BlockSchema::new("block-1", BlockType::Container, "Main Container");
        project.add_block(block);
        
        let found = project.find_block("block-1");
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Main Container");
    }
    
    #[test]
    fn test_archive() {
        use crate::schema::BlockType;
        
        let mut project = ProjectSchema::new("proj-3", "Test");
        project.add_block(BlockSchema::new("block-1", BlockType::Text, "Hello"));
        
        assert!(project.archive_block("block-1"));
        assert!(project.find_block("block-1").is_none()); // Archived blocks not found
    }
    
    #[test]
    fn test_serialization() {
        let project = ProjectSchema::new("proj-4", "Serialization Test");
        let json = project.to_json().expect("Serialize failed");
        let restored = ProjectSchema::from_json(&json).expect("Deserialize failed");
        
        assert_eq!(restored.id, project.id);
        assert_eq!(restored.name, project.name);
    }
}
