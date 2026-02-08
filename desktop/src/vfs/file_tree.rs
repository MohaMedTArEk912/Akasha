//! Virtual File Tree
//! 
//! Builds a file tree view from the project schema.

use serde::{Deserialize, Serialize};
use crate::schema::ProjectSchema;

/// A virtual file in the VFS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualFile {
    /// File path (virtual, e.g., "/pages/Home.page")
    pub path: String,
    
    /// File name
    pub name: String,
    
    /// File type
    pub file_type: VirtualFileType,
    
    /// Entity ID this file represents
    pub entity_id: String,
    
    /// Whether this is a directory (contains children)
    pub is_directory: bool,
    
    /// Child files (for directories)
    pub children: Vec<VirtualFile>,
    
    /// Icon name for UI
    pub icon: String,
}

/// Virtual file types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VirtualFileType {
    /// Directory (folder)
    Directory,
    
    /// Page file (.page)
    Page,
    
    /// Component/Block file (.component)
    Component,
    
    /// API endpoint file (.api)
    Api,
    
    /// Data model file (.model)
    Model,
    
    /// Logic flow file (.flow)
    Flow,
    
    /// Variable file (.var) 
    Variable,
}

impl VirtualFile {
    /// Create a new directory
    pub fn directory(path: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            name: name.into(),
            file_type: VirtualFileType::Directory,
            entity_id: String::new(),
            is_directory: true,
            children: Vec::new(),
            icon: "folder".into(),
        }
    }
    
    /// Create a new file
    pub fn file(
        path: impl Into<String>,
        name: impl Into<String>,
        file_type: VirtualFileType,
        entity_id: impl Into<String>,
    ) -> Self {
        let icon = match file_type {
            VirtualFileType::Directory => "folder",
            VirtualFileType::Page => "file-text",
            VirtualFileType::Component => "box",
            VirtualFileType::Api => "zap",
            VirtualFileType::Model => "database",
            VirtualFileType::Flow => "git-branch",
            VirtualFileType::Variable => "variable",
        };
        
        Self {
            path: path.into(),
            name: name.into(),
            file_type,
            entity_id: entity_id.into(),
            is_directory: false,
            children: Vec::new(),
            icon: icon.into(),
        }
    }
    
    /// Add a child to this directory
    pub fn with_child(mut self, child: VirtualFile) -> Self {
        self.children.push(child);
        self
    }
}

/// Build a complete file tree from a project schema
/// 
/// # Arguments
/// * `project` - The project schema to build from
/// 
/// # Returns
/// The root VirtualFile representing the project root
pub fn build_file_tree(project: &ProjectSchema) -> VirtualFile {
    let mut root = VirtualFile::directory("/", &project.name);
    
    // Pages folder
    let mut pages_dir = VirtualFile::directory("/pages", "Pages");
    for page in &project.pages {
        if !page.archived {
            let file = VirtualFile::file(
                format!("/pages/{}.page", page.name),
                format!("{}.page", page.name),
                VirtualFileType::Page,
                &page.id,
            );
            pages_dir.children.push(file);
        }
    }
    root.children.push(pages_dir);
    
    // Components folder (blocks that are not tied to pages)
    let mut components_dir = VirtualFile::directory("/components", "Components");
    for block in &project.blocks {
        if !block.archived && block.parent_id.is_none() {
            let file = VirtualFile::file(
                format!("/components/{}.component", block.name),
                format!("{}.component", block.name),
                VirtualFileType::Component,
                &block.id,
            );
            components_dir.children.push(file);
        }
    }
    root.children.push(components_dir);
    
    // API folder
    let mut api_dir = VirtualFile::directory("/api", "API");
    for api in &project.apis {
        if !api.archived {
            let file = VirtualFile::file(
                format!("/api/{}.api", api.name),
                format!("{}.api", api.name),
                VirtualFileType::Api,
                &api.id,
            );
            api_dir.children.push(file);
        }
    }
    root.children.push(api_dir);
    
    // Models folder
    let mut models_dir = VirtualFile::directory("/models", "Models");
    for model in &project.data_models {
        if !model.archived {
            let file = VirtualFile::file(
                format!("/models/{}.model", model.name),
                format!("{}.model", model.name),
                VirtualFileType::Model,
                &model.id,
            );
            models_dir.children.push(file);
        }
    }
    root.children.push(models_dir);
    
    // Logic flows folder
    let mut flows_dir = VirtualFile::directory("/flows", "Logic");
    for flow in &project.logic_flows {
        if !flow.archived {
            let file = VirtualFile::file(
                format!("/flows/{}.flow", flow.name),
                format!("{}.flow", flow.name),
                VirtualFileType::Flow,
                &flow.id,
            );
            flows_dir.children.push(file);
        }
    }
    root.children.push(flows_dir);
    
    root
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{PageSchema, ApiSchema, HttpMethod};

    #[test]
    fn test_build_file_tree() {
        let mut project = ProjectSchema::new("proj-1", "Test App");
        project.add_page(PageSchema::new("page-extra", "Dashboard", "/dashboard"));
        project.add_api(ApiSchema::new("api-extra", HttpMethod::Get, "/health", "Health Check"));

        let tree = build_file_tree(&project);

        assert_eq!(tree.name, "Test App");
        assert_eq!(tree.children.len(), 5); // pages, components, api, models, flows

        // Pages folder should have 4 pages (Home + About + Contact defaults + Dashboard)
        let pages = tree.children.iter().find(|c| c.name == "Pages").unwrap();
        assert_eq!(pages.children.len(), 4);

        // API folder should have 6 endpoints (5 defaults + Health Check)
        let api = tree.children.iter().find(|c| c.name == "API").unwrap();
        assert_eq!(api.children.len(), 6);
    }
}
