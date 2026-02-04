//! Logic Flow Schema - Visual logic/event definitions
//! 
//! Logic flows represent visual programming graphs that compile to
//! JavaScript/TypeScript code for both frontend and backend.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Logic Flow Schema - represents a visual logic graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogicFlowSchema {
    /// Unique identifier (UUID v4)
    pub id: String,
    
    /// User-friendly name
    pub name: String,
    
    /// Description of what this flow does
    pub description: Option<String>,
    
    /// What triggers this flow
    pub trigger: TriggerType,
    
    /// All nodes in the flow
    pub nodes: Vec<LogicNode>,
    
    /// Entry node ID (first node to execute)
    pub entry_node_id: Option<String>,
    
    /// Where this flow is used (frontend/backend)
    pub context: FlowContext,
    
    /// Whether this flow is archived (soft deleted)
    pub archived: bool,
}

/// What triggers the execution of a logic flow
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TriggerType {
    /// Triggered by a UI event (onClick, onChange, etc.)
    Event { 
        /// Component ID that triggers this
        component_id: String,
        /// Event name (click, change, submit, load, etc.)
        event: String,
    },
    
    /// Triggered by an API endpoint
    Api {
        /// API schema ID
        api_id: String,
    },
    
    /// Triggered on page/component mount
    Mount {
        /// Page or component ID
        component_id: String,
    },
    
    /// Triggered on a schedule (cron)
    Schedule {
        /// Cron expression
        cron: String,
    },
    
    /// Triggered manually (callable function)
    Manual,
}

/// Where the flow executes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FlowContext {
    Frontend,
    Backend,
}

/// A single node in the logic graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogicNode {
    /// Unique identifier
    pub id: String,
    
    /// Node type (determines behavior)
    pub node_type: LogicNodeType,
    
    /// Node-specific data/configuration
    pub data: Value,
    
    /// Label for display
    pub label: Option<String>,
    
    /// IDs of nodes to execute next (normal flow)
    pub next_nodes: Vec<String>,
    
    /// IDs of nodes to execute on else/error (for conditions)
    pub else_nodes: Vec<String>,
    
    /// Position in the visual canvas (for UI)
    pub position: NodePosition,
}

/// Node types in the logic graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogicNodeType {
    // Control flow
    /// Conditional branch
    Condition,
    /// Loop over array
    ForEach,
    /// While loop
    While,
    /// Wait/delay
    Delay,
    /// Try-catch error handling
    TryCatch,
    
    // Data operations
    /// Set a variable
    SetVariable,
    /// Read a variable
    GetVariable,
    /// Transform data
    Transform,
    
    // UI actions (frontend)
    /// Navigate to page
    Navigate,
    /// Show alert/toast
    Alert,
    /// Open modal
    OpenModal,
    /// Close modal
    CloseModal,
    /// Toggle CSS class
    ToggleClass,
    /// Set element property
    SetProperty,
    
    // API actions (frontend)
    /// Fetch from API
    FetchApi,
    
    // Database operations (backend)
    /// Create record
    DbCreate,
    /// Read record(s)
    DbRead,
    /// Update record
    DbUpdate,
    /// Delete record
    DbDelete,
    
    // Response actions (backend)
    /// Return API response
    Return,
    /// Throw error
    ThrowError,
    
    // Integrations
    /// Send email
    SendEmail,
    /// Call external API
    HttpRequest,
    
    // Custom
    /// Execute custom JavaScript
    CustomCode,
}

/// Position on the visual canvas
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

impl LogicFlowSchema {
    /// Create a new logic flow
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `name` - Display name
    /// * `trigger` - What triggers this flow
    /// * `context` - Where this flow runs
    /// 
    /// # Returns
    /// A new LogicFlowSchema with default values
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        trigger: TriggerType,
        context: FlowContext,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: None,
            trigger,
            nodes: Vec::new(),
            entry_node_id: None,
            context,
            archived: false,
        }
    }
    
    /// Add a node to the flow
    pub fn with_node(mut self, node: LogicNode) -> Self {
        // Set as entry if first node
        if self.entry_node_id.is_none() {
            self.entry_node_id = Some(node.id.clone());
        }
        self.nodes.push(node);
        self
    }
    
    /// Set the entry node
    pub fn with_entry(mut self, node_id: impl Into<String>) -> Self {
        self.entry_node_id = Some(node_id.into());
        self
    }
}

impl LogicNode {
    /// Create a new logic node
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `node_type` - Type of node
    /// * `data` - Node configuration
    /// 
    /// # Returns
    /// A new LogicNode with default values
    pub fn new(id: impl Into<String>, node_type: LogicNodeType, data: Value) -> Self {
        Self {
            id: id.into(),
            node_type,
            data,
            label: None,
            next_nodes: Vec::new(),
            else_nodes: Vec::new(),
            position: NodePosition::default(),
        }
    }
    
    /// Set the label
    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
    
    /// Add a next node connection
    pub fn then(mut self, node_id: impl Into<String>) -> Self {
        self.next_nodes.push(node_id.into());
        self
    }
    
    /// Add an else node connection
    pub fn otherwise(mut self, node_id: impl Into<String>) -> Self {
        self.else_nodes.push(node_id.into());
        self
    }
    
    /// Set position
    pub fn at(mut self, x: f64, y: f64) -> Self {
        self.position = NodePosition { x, y };
        self
    }
}

/// Helper struct for building common action data
#[allow(dead_code)]
pub struct ActionData;

#[allow(dead_code)]
impl ActionData {
    /// Create SetVariable action data
    pub fn set_variable(name: &str, value: Value) -> Value {
        serde_json::json!({
            "variableName": name,
            "value": value
        })
    }
    
    /// Create Navigate action data
    pub fn navigate(path: &str) -> Value {
        serde_json::json!({
            "path": path
        })
    }
    
    /// Create Alert action data
    pub fn alert(message: &str, alert_type: &str) -> Value {
        serde_json::json!({
            "message": message,
            "type": alert_type
        })
    }
    
    /// Create Condition data
    pub fn condition(left: &str, operator: &str, right: Value) -> Value {
        serde_json::json!({
            "left": left,
            "operator": operator,
            "right": right
        })
    }
    
    /// Create DbRead action data
    pub fn db_read(model: &str, filter: Option<Value>) -> Value {
        serde_json::json!({
            "model": model,
            "filter": filter,
            "findMany": true
        })
    }
    
    /// Create DbCreate action data
    pub fn db_create(model: &str, data: Value) -> Value {
        serde_json::json!({
            "model": model,
            "data": data
        })
    }
    
    /// Create Return action data
    pub fn return_response(status: u16, data: Value) -> Value {
        serde_json::json!({
            "status": status,
            "data": data
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_flow() {
        let flow = LogicFlowSchema::new(
            "flow-1",
            "Handle Click",
            TriggerType::Event {
                component_id: "btn-1".into(),
                event: "click".into(),
            },
            FlowContext::Frontend,
        );
        
        assert_eq!(flow.id, "flow-1");
        assert_eq!(flow.context, FlowContext::Frontend);
        assert!(!flow.archived);
    }
    
    #[test]
    fn test_flow_with_nodes() {
        let flow = LogicFlowSchema::new(
            "flow-2",
            "API Handler",
            TriggerType::Api { api_id: "api-1".into() },
            FlowContext::Backend,
        )
        .with_node(
            LogicNode::new("n1", LogicNodeType::DbRead, ActionData::db_read("User", None))
                .with_label("Fetch Users")
                .then("n2")
        )
        .with_node(
            LogicNode::new("n2", LogicNodeType::Return, ActionData::return_response(200, serde_json::json!({"ok": true})))
                .with_label("Return Response")
        );
        
        assert_eq!(flow.nodes.len(), 2);
        assert_eq!(flow.entry_node_id, Some("n1".into()));
    }
    
    #[test]
    fn test_node_builder() {
        let node = LogicNode::new("n1", LogicNodeType::Condition, serde_json::json!({}))
            .with_label("Check Admin")
            .at(100.0, 200.0)
            .then("n2")
            .otherwise("n3");
            
        assert_eq!(node.next_nodes.len(), 1);
        assert_eq!(node.else_nodes.len(), 1);
        assert_eq!(node.position.x, 100.0);
    }
}
