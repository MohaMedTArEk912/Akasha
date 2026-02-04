//! Variable Schema - State variable definitions
//! 
//! Variables represent global or component state that can be 
//! used in logic flows and bindings.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Variable Schema - represents a state variable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableSchema {
    /// Unique identifier (UUID v4)
    pub id: String,
    
    /// Variable name (must be valid JavaScript identifier)
    pub name: String,
    
    /// Variable data type
    pub var_type: VariableType,
    
    /// Default value
    pub default_value: Value,
    
    /// Description of what this variable is for
    pub description: Option<String>,
    
    /// Scope of this variable
    pub scope: VariableScope,
    
    /// Whether this variable should persist across sessions
    pub persist: bool,
    
    /// Whether this variable is archived (soft deleted)
    pub archived: bool,
}

/// Variable data types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VariableType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

/// Variable scope
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VariableScope {
    /// Global - available everywhere in the app
    Global,
    
    /// Page - only available on a specific page
    Page { page_id: String },
    
    /// Component - only available in a specific component
    Component { component_id: String },
}

impl VariableSchema {
    /// Create a new variable
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `name` - Variable name
    /// * `var_type` - Data type
    /// * `default_value` - Default value
    /// 
    /// # Returns
    /// A new VariableSchema with default values
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        var_type: VariableType,
        default_value: Value,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            var_type,
            default_value,
            description: None,
            scope: VariableScope::Global,
            persist: false,
            archived: false,
        }
    }
    
    /// Create a string variable
    pub fn string(id: impl Into<String>, name: impl Into<String>, default: impl Into<String>) -> Self {
        Self::new(id, name, VariableType::String, Value::String(default.into()))
    }
    
    /// Create a number variable
    pub fn number(id: impl Into<String>, name: impl Into<String>, default: f64) -> Self {
        Self::new(id, name, VariableType::Number, Value::Number(serde_json::Number::from_f64(default).unwrap_or(serde_json::Number::from(0))))
    }
    
    /// Create a boolean variable
    pub fn boolean(id: impl Into<String>, name: impl Into<String>, default: bool) -> Self {
        Self::new(id, name, VariableType::Boolean, Value::Bool(default))
    }
    
    /// Create an array variable
    pub fn array(id: impl Into<String>, name: impl Into<String>, default: Vec<Value>) -> Self {
        Self::new(id, name, VariableType::Array, Value::Array(default))
    }
    
    /// Create an object variable
    pub fn object(id: impl Into<String>, name: impl Into<String>, default: serde_json::Map<String, Value>) -> Self {
        Self::new(id, name, VariableType::Object, Value::Object(default))
    }
    
    /// Set description
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }
    
    /// Set scope to page
    pub fn for_page(mut self, page_id: impl Into<String>) -> Self {
        self.scope = VariableScope::Page { page_id: page_id.into() };
        self
    }
    
    /// Set scope to component
    pub fn for_component(mut self, component_id: impl Into<String>) -> Self {
        self.scope = VariableScope::Component { component_id: component_id.into() };
        self
    }
    
    /// Enable persistence
    pub fn persistent(mut self) -> Self {
        self.persist = true;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_variable() {
        let var = VariableSchema::string("var-1", "username", "");
        assert_eq!(var.name, "username");
        assert_eq!(var.var_type, VariableType::String);
        assert_eq!(var.scope, VariableScope::Global);
    }
    
    #[test]
    fn test_number_variable() {
        let var = VariableSchema::number("var-2", "count", 0.0)
            .with_description("Item counter")
            .persistent();
            
        assert_eq!(var.var_type, VariableType::Number);
        assert!(var.persist);
        assert!(var.description.is_some());
    }
    
    #[test]
    fn test_scoped_variable() {
        let var = VariableSchema::boolean("var-3", "isOpen", false)
            .for_component("modal-1");
            
        assert!(matches!(var.scope, VariableScope::Component { .. }));
    }
}
