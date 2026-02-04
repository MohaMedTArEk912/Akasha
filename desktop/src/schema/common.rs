//! Common types shared across schemas

use serde::{Deserialize, Serialize};

/// Page schema - represents a single page in the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSchema {
    /// Unique identifier
    pub id: String,
    
    /// Page name (e.g., "Home", "About")
    pub name: String,
    
    /// URL path for this page (e.g., "/", "/about")
    pub path: String,
    
    /// Root block ID for this page
    pub root_block_id: Option<String>,
    
    /// SEO metadata
    pub meta: PageMeta,
    
    /// Whether this page is archived (soft deleted)
    pub archived: bool,
}

/// SEO metadata for a page
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PageMeta {
    /// Page title for SEO
    pub title: Option<String>,
    
    /// Meta description
    pub description: Option<String>,
    
    /// OpenGraph image URL
    pub og_image: Option<String>,
    
    /// Custom head content (scripts, styles)
    pub custom_head: Option<String>,
}

impl PageSchema {
    /// Create a new page with default values
    /// 
    /// # Arguments
    /// * `id` - Unique identifier for the page
    /// * `name` - Display name
    /// * `path` - URL path
    /// 
    /// # Returns
    /// A new PageSchema with default meta and not archived
    pub fn new(id: impl Into<String>, name: impl Into<String>, path: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            path: path.into(),
            root_block_id: None,
            meta: PageMeta::default(),
            archived: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_page() {
        let page = PageSchema::new("page-1", "Home", "/");
        assert_eq!(page.id, "page-1");
        assert_eq!(page.name, "Home");
        assert_eq!(page.path, "/");
        assert!(!page.archived);
    }
}
