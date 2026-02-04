//! Block Schema - UI component definitions
//! 
//! Blocks represent visual UI components that compile to React code.
//! Each block has properties, styles, and can contain child blocks.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Block schema - represents a single UI component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSchema {
    /// Unique identifier (UUID v4)
    pub id: String,
    
    /// Type of block (determines rendering and properties)
    pub block_type: BlockType,
    
    /// User-friendly name for this block instance
    pub name: String,
    
    /// Component-specific properties (e.g., text content, href, src)
    pub properties: HashMap<String, Value>,
    
    /// Child block IDs (for container blocks)
    pub children: Vec<String>,
    
    /// Parent block ID (None for root blocks)
    pub parent_id: Option<String>,
    
    /// CSS styles for this block
    pub styles: HashMap<String, StyleValue>,
    
    /// Responsive style overrides per breakpoint
    pub responsive_styles: HashMap<Breakpoint, HashMap<String, StyleValue>>,
    
    /// CSS classes (Tailwind utility classes)
    pub classes: Vec<String>,
    
    /// Event bindings (event name -> logic flow ID)
    pub events: HashMap<String, String>,
    
    /// Whether this block is archived (soft deleted)
    pub archived: bool,
    
    /// Block order within parent (for sorting)
    pub order: i32,
}

/// Available block types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum BlockType {
    // Layout blocks
    Page,
    Container,
    Section,
    Columns,
    Column,
    Flex,
    Grid,
    
    // Text blocks
    Text,
    Heading,
    Paragraph,
    Link,
    
    // Media blocks
    Image,
    Video,
    Icon,
    
    // Form blocks
    Form,
    Input,
    TextArea,
    Select,
    Checkbox,
    Radio,
    Button,
    
    // Interactive blocks
    Modal,
    Dropdown,
    Tabs,
    Accordion,
    
    // Data blocks
    List,
    Table,
    Card,
    
    // Custom/Symbol
    Custom(String), // Reference to a shared component or custom type
}

/// Style value - supports different CSS value types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StyleValue {
    /// Simple string value (e.g., "red", "10px", "flex")
    String(String),
    
    /// Numeric value (unitless)
    Number(f64),
    
    /// Boolean value (for toggle properties)
    Boolean(bool),
}

impl From<&str> for StyleValue {
    fn from(s: &str) -> Self {
        StyleValue::String(s.to_string())
    }
}

impl From<String> for StyleValue {
    fn from(s: String) -> Self {
        StyleValue::String(s)
    }
}

impl From<f64> for StyleValue {
    fn from(n: f64) -> Self {
        StyleValue::Number(n)
    }
}

impl From<i32> for StyleValue {
    fn from(n: i32) -> Self {
        StyleValue::Number(n as f64)
    }
}

impl From<bool> for StyleValue {
    fn from(b: bool) -> Self {
        StyleValue::Boolean(b)
    }
}

/// Responsive breakpoints
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Breakpoint {
    Mobile,  // < 640px
    Tablet,  // 640px - 1024px
    Desktop, // > 1024px
}

impl BlockSchema {
    /// Create a new block with minimal required fields
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `block_type` - Type of the block
    /// * `name` - Display name
    /// 
    /// # Returns
    /// A new BlockSchema with default values for optional fields
    pub fn new(id: impl Into<String>, block_type: BlockType, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            block_type,
            name: name.into(),
            properties: HashMap::new(),
            children: Vec::new(),
            parent_id: None,
            styles: HashMap::new(),
            responsive_styles: HashMap::new(),
            classes: Vec::new(),
            events: HashMap::new(),
            archived: false,
            order: 0,
        }
    }
    
    /// Add a property to the block
    pub fn with_property(mut self, key: impl Into<String>, value: Value) -> Self {
        self.properties.insert(key.into(), value);
        self
    }
    
    /// Add a style to the block
    pub fn with_style(mut self, key: impl Into<String>, value: impl Into<StyleValue>) -> Self {
        self.styles.insert(key.into(), value.into());
        self
    }
    
    /// Add a CSS class
    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.classes.push(class.into());
        self
    }
    
    /// Set parent ID
    pub fn with_parent(mut self, parent_id: impl Into<String>) -> Self {
        self.parent_id = Some(parent_id.into());
        self
    }
    
    /// Add a child block ID
    pub fn with_child(mut self, child_id: impl Into<String>) -> Self {
        self.children.push(child_id.into());
        self
    }
    
    /// Bind an event to a logic flow
    pub fn with_event(mut self, event: impl Into<String>, flow_id: impl Into<String>) -> Self {
        self.events.insert(event.into(), flow_id.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_block() {
        let block = BlockSchema::new("block-1", BlockType::Container, "My Container");
        assert_eq!(block.id, "block-1");
        assert_eq!(block.block_type, BlockType::Container);
        assert_eq!(block.name, "My Container");
        assert!(block.children.is_empty());
        assert!(!block.archived);
    }
    
    #[test]
    fn test_block_builder() {
        let block = BlockSchema::new("btn-1", BlockType::Button, "Submit Button")
            .with_property("text".into(), Value::String("Click Me".into()))
            .with_style("backgroundColor", "#6366f1")
            .with_class("rounded-lg")
            .with_class("px-4");
            
        assert_eq!(block.properties.len(), 1);
        assert_eq!(block.styles.len(), 1);
        assert_eq!(block.classes.len(), 2);
    }
    
    #[test]
    fn test_style_value_conversions() {
        let s: StyleValue = "red".into();
        assert!(matches!(s, StyleValue::String(_)));
        
        let n: StyleValue = 10.5.into();
        assert!(matches!(n, StyleValue::Number(_)));
        
        let b: StyleValue = true.into();
        assert!(matches!(b, StyleValue::Boolean(_)));
    }
}
