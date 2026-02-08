//! Project Schema - Master schema that ties everything together
//! 
//! The ProjectSchema is the single source of truth for an entire project.
//! It contains all blocks, pages, APIs, data models, logic flows, and variables.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::{
    BlockSchema, BlockType, ApiSchema, HttpMethod, DataModelSchema, LogicFlowSchema,
    VariableSchema, PageSchema
};
use super::data_model::{FieldSchema, FieldType, DefaultValue};

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

    /// Root directory on the physical file system (if exported/synced)
    pub root_path: Option<String>,
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
    
    /// Create a new project with default content
    ///
    /// # Arguments
    /// * `id` - Unique project identifier
    /// * `name` - Project name
    ///
    /// # Returns
    /// A new ProjectSchema with default pages (Home, About, Contact),
    /// starter blocks, a User data model, and CRUD API endpoints
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        let id_str = id.into();
        let name_str = name.into();
        let now = Utc::now();

        // ===== Pages =====
        let home_page_id = format!("{}-home", &id_str);
        let about_page_id = format!("{}-about", &id_str);
        let contact_page_id = format!("{}-contact", &id_str);

        let home_root_id = format!("{}-home-root", &id_str);
        let about_root_id = format!("{}-about-root", &id_str);
        let contact_root_id = format!("{}-contact-root", &id_str);

        let mut home_page = PageSchema::new(&home_page_id, "Home", "/");
        home_page.root_block_id = Some(home_root_id.clone());

        let mut about_page = PageSchema::new(&about_page_id, "About", "/about");
        about_page.root_block_id = Some(about_root_id.clone());

        let mut contact_page = PageSchema::new(&contact_page_id, "Contact", "/contact");
        contact_page.root_block_id = Some(contact_root_id.clone());

        // ===== Home Page Blocks =====
        let header_id = format!("{}-header", &id_str);
        let header_title_id = format!("{}-header-title", &id_str);
        let hero_id = format!("{}-hero", &id_str);
        let hero_heading_id = format!("{}-hero-heading", &id_str);
        let hero_text_id = format!("{}-hero-text", &id_str);
        let hero_btn_id = format!("{}-hero-btn", &id_str);
        let footer_id = format!("{}-footer", &id_str);
        let footer_text_id = format!("{}-footer-text", &id_str);

        let mut home_root = BlockSchema::new(&home_root_id, BlockType::Container, "Page Root");
        home_root.children = vec![header_id.clone(), hero_id.clone(), footer_id.clone()];
        home_root.order = 0;

        let mut header = BlockSchema::new(&header_id, BlockType::Section, "Header");
        header.parent_id = Some(home_root_id.clone());
        header.children = vec![header_title_id.clone()];
        header.order = 0;
        header.classes = ["bg-white", "shadow-sm", "py-4", "px-6"].iter().map(|s| s.to_string()).collect();

        let mut header_title = BlockSchema::new(&header_title_id, BlockType::Heading, "Site Title");
        header_title.parent_id = Some(header_id.clone());
        header_title.order = 0;
        header_title.classes = ["text-xl", "font-bold", "text-indigo-600"].iter().map(|s| s.to_string()).collect();
        header_title.properties.insert("text".into(), serde_json::Value::String(name_str.clone()));

        let mut hero = BlockSchema::new(&hero_id, BlockType::Section, "Hero");
        hero.parent_id = Some(home_root_id.clone());
        hero.children = vec![hero_heading_id.clone(), hero_text_id.clone(), hero_btn_id.clone()];
        hero.order = 1;
        hero.classes = ["py-20", "px-6", "text-center"].iter().map(|s| s.to_string()).collect();

        let mut hero_heading = BlockSchema::new(&hero_heading_id, BlockType::Heading, "Hero Title");
        hero_heading.parent_id = Some(hero_id.clone());
        hero_heading.order = 0;
        hero_heading.classes = ["text-4xl", "font-bold", "text-gray-900", "mb-4"].iter().map(|s| s.to_string()).collect();
        hero_heading.properties.insert("text".into(), serde_json::Value::String(format!("Welcome to {}", &name_str)));

        let mut hero_text = BlockSchema::new(&hero_text_id, BlockType::Paragraph, "Hero Description");
        hero_text.parent_id = Some(hero_id.clone());
        hero_text.order = 1;
        hero_text.classes = ["text-lg", "text-gray-600", "mb-8"].iter().map(|s| s.to_string()).collect();
        hero_text.properties.insert("text".into(), serde_json::Value::String("Build something amazing with your new project.".into()));

        let mut hero_btn = BlockSchema::new(&hero_btn_id, BlockType::Button, "Get Started");
        hero_btn.parent_id = Some(hero_id.clone());
        hero_btn.order = 2;
        hero_btn.classes = ["bg-indigo-600", "text-white", "px-6", "py-3", "rounded-lg"].iter().map(|s| s.to_string()).collect();
        hero_btn.properties.insert("text".into(), serde_json::Value::String("Get Started".into()));

        let mut footer = BlockSchema::new(&footer_id, BlockType::Section, "Footer");
        footer.parent_id = Some(home_root_id.clone());
        footer.children = vec![footer_text_id.clone()];
        footer.order = 2;
        footer.classes = ["py-8", "px-6", "text-center", "bg-gray-50", "border-t"].iter().map(|s| s.to_string()).collect();

        let mut footer_text = BlockSchema::new(&footer_text_id, BlockType::Paragraph, "Copyright");
        footer_text.parent_id = Some(footer_id.clone());
        footer_text.order = 0;
        footer_text.classes = ["text-sm", "text-gray-500"].iter().map(|s| s.to_string()).collect();
        footer_text.properties.insert("text".into(), serde_json::Value::String(format!("\u{00A9} 2025 {}. All rights reserved.", &name_str)));

        // ===== About Page Blocks =====
        let about_heading_id = format!("{}-about-heading", &id_str);
        let about_text_id = format!("{}-about-text", &id_str);

        let mut about_root = BlockSchema::new(&about_root_id, BlockType::Container, "Page Root");
        about_root.children = vec![about_heading_id.clone(), about_text_id.clone()];
        about_root.order = 0;

        let mut about_heading = BlockSchema::new(&about_heading_id, BlockType::Heading, "About Title");
        about_heading.parent_id = Some(about_root_id.clone());
        about_heading.order = 0;
        about_heading.classes = ["text-3xl", "font-bold", "text-gray-900", "mb-4", "px-6", "pt-10"].iter().map(|s| s.to_string()).collect();
        about_heading.properties.insert("text".into(), serde_json::Value::String("About Us".into()));

        let mut about_text = BlockSchema::new(&about_text_id, BlockType::Paragraph, "About Description");
        about_text.parent_id = Some(about_root_id.clone());
        about_text.order = 1;
        about_text.classes = ["text-lg", "text-gray-600", "px-6"].iter().map(|s| s.to_string()).collect();
        about_text.properties.insert("text".into(), serde_json::Value::String("Learn more about our project and what we do.".into()));

        // ===== Contact Page Blocks =====
        let contact_heading_id = format!("{}-contact-heading", &id_str);
        let contact_text_id = format!("{}-contact-text", &id_str);

        let mut contact_root = BlockSchema::new(&contact_root_id, BlockType::Container, "Page Root");
        contact_root.children = vec![contact_heading_id.clone(), contact_text_id.clone()];
        contact_root.order = 0;

        let mut contact_heading = BlockSchema::new(&contact_heading_id, BlockType::Heading, "Contact Title");
        contact_heading.parent_id = Some(contact_root_id.clone());
        contact_heading.order = 0;
        contact_heading.classes = ["text-3xl", "font-bold", "text-gray-900", "mb-4", "px-6", "pt-10"].iter().map(|s| s.to_string()).collect();
        contact_heading.properties.insert("text".into(), serde_json::Value::String("Contact Us".into()));

        let mut contact_text = BlockSchema::new(&contact_text_id, BlockType::Paragraph, "Contact Description");
        contact_text.parent_id = Some(contact_root_id.clone());
        contact_text.order = 1;
        contact_text.classes = ["text-lg", "text-gray-600", "px-6"].iter().map(|s| s.to_string()).collect();
        contact_text.properties.insert("text".into(), serde_json::Value::String("Get in touch with us. We would love to hear from you.".into()));

        // ===== Default Data Model: User =====
        let user_model_id = format!("{}-model-user", &id_str);
        let user_model = DataModelSchema::new(&user_model_id, "User")
            .with_field(FieldSchema::new(format!("{}-field-email", &id_str), "email", FieldType::Email).unique())
            .with_field(FieldSchema::new(format!("{}-field-name", &id_str), "name", FieldType::String))
            .with_field(FieldSchema::new(format!("{}-field-role", &id_str), "role", FieldType::String)
                .with_default(DefaultValue::Static { value: "user".into() }));

        // ===== Default API Endpoints =====
        let api_list = ApiSchema::new(format!("{}-api-list-users", &id_str), HttpMethod::Get, "/api/users", "List Users");
        let api_create = ApiSchema::new(format!("{}-api-create-user", &id_str), HttpMethod::Post, "/api/users", "Create User");
        let api_get = ApiSchema::new(format!("{}-api-get-user", &id_str), HttpMethod::Get, "/api/users/:id", "Get User");
        let api_update = ApiSchema::new(format!("{}-api-update-user", &id_str), HttpMethod::Put, "/api/users/:id", "Update User");
        let api_delete = ApiSchema::new(format!("{}-api-delete-user", &id_str), HttpMethod::Delete, "/api/users/:id", "Delete User");

        Self {
            version: Self::CURRENT_VERSION.into(),
            id: id_str,
            name: name_str,
            description: None,
            created_at: now,
            updated_at: now,
            blocks: vec![
                home_root, header, header_title,
                hero, hero_heading, hero_text, hero_btn,
                footer, footer_text,
                about_root, about_heading, about_text,
                contact_root, contact_heading, contact_text,
            ],
            pages: vec![home_page, about_page, contact_page],
            apis: vec![api_list, api_create, api_get, api_update, api_delete],
            logic_flows: Vec::new(),
            data_models: vec![user_model],
            variables: Vec::new(),
            settings: ProjectSettings::default(),
            root_path: None,
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
    
    /// Find a page by ID (mutable)
    pub fn find_page_mut(&mut self, id: &str) -> Option<&mut PageSchema> {
        self.pages.iter_mut().find(|p| p.id == id && !p.archived)
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

    /// Update a page in the project
    pub fn update_page(&mut self, page: PageSchema) {
        if let Some(p) = self.pages.iter_mut().find(|p| p.id == page.id) {
            *p = page;
            self.touch();
        }
    }

    /// Archive a page by ID (soft delete)
    pub fn archive_page(&mut self, id: &str) -> bool {
        if let Some(page) = self.pages.iter_mut().find(|p| p.id == id) {
            page.archived = true;
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
        // Should have 3 default pages
        assert_eq!(project.pages.len(), 3);
        assert_eq!(project.pages[0].path, "/");
        assert_eq!(project.pages[1].path, "/about");
        assert_eq!(project.pages[2].path, "/contact");
        // Should have default blocks
        assert_eq!(project.blocks.len(), 15);
        // Should have default User data model
        assert_eq!(project.data_models.len(), 1);
        assert_eq!(project.data_models[0].name, "User");
        // Should have 5 CRUD API endpoints
        assert_eq!(project.apis.len(), 5);
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
