//! API Schema - Backend endpoint definitions
//! 
//! APIs represent backend endpoints that compile to NestJS/Express code.
//! Each API has a method, path, request/response shapes, and logic flow.

use serde::{Deserialize, Serialize};

/// API Schema - represents a single backend endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSchema {
    /// Unique identifier (UUID v4)
    pub id: String,
    
    /// HTTP method
    pub method: HttpMethod,
    
    /// URL path (e.g., "/users", "/posts/:id")
    pub path: String,
    
    /// User-friendly name
    pub name: String,
    
    /// Description of what this endpoint does
    pub description: Option<String>,
    
    /// Request body shape (for POST, PUT, PATCH)
    pub request_body: Option<DataShape>,
    
    /// Query parameters
    pub query_params: Vec<ParamSchema>,
    
    /// Path parameters (extracted from path like :id)
    pub path_params: Vec<ParamSchema>,
    
    /// Response body shape
    pub response_body: Option<DataShape>,
    
    /// Logic flow ID that handles this endpoint
    pub logic_flow_id: Option<String>,
    
    /// Required permissions/roles
    pub permissions: Vec<String>,
    
    /// Rate limiting configuration
    pub rate_limit: Option<RateLimitConfig>,
    
    /// Whether this API is archived (soft deleted)
    pub archived: bool,
}

/// HTTP methods
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

/// Data shape - describes the structure of request/response bodies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataShape {
    /// Shape type
    pub shape_type: ShapeType,
    
    /// Fields (for object type)
    pub fields: Option<Vec<ShapeField>>,
    
    /// Item shape (for array type)
    pub item_shape: Option<Box<DataShape>>,
    
    /// Reference to a data model (for model type)
    pub model_ref: Option<String>,
}

/// Shape types for data structures
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ShapeType {
    Object,
    Array,
    String,
    Number,
    Boolean,
    Model, // Reference to a DataModel
}

/// Field within a data shape
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShapeField {
    /// Field name
    pub name: String,
    
    /// Field type
    pub field_type: ShapeType,
    
    /// Whether this field is required
    pub required: bool,
    
    /// Nested shape (for object/array fields)
    pub nested: Option<Box<DataShape>>,
}

/// Parameter schema (for query/path params)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamSchema {
    /// Parameter name
    pub name: String,
    
    /// Parameter type
    pub param_type: ShapeType,
    
    /// Whether this parameter is required
    pub required: bool,
    
    /// Default value
    pub default: Option<String>,
    
    /// Validation rules
    pub validations: Vec<ValidationRule>,
}

/// Validation rules for parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ValidationRule {
    MinLength { value: u32 },
    MaxLength { value: u32 },
    Min { value: f64 },
    Max { value: f64 },
    Pattern { regex: String },
    Email,
    Url,
    Uuid,
}

/// Rate limiting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Maximum requests allowed
    pub max_requests: u32,
    
    /// Time window in seconds
    pub window_seconds: u32,
}

impl ApiSchema {
    /// Create a new API endpoint
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `method` - HTTP method
    /// * `path` - URL path
    /// * `name` - Display name
    /// 
    /// # Returns
    /// A new ApiSchema with default values
    pub fn new(
        id: impl Into<String>,
        method: HttpMethod,
        path: impl Into<String>,
        name: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            method,
            path: path.into(),
            name: name.into(),
            description: None,
            request_body: None,
            query_params: Vec::new(),
            path_params: Vec::new(),
            response_body: None,
            logic_flow_id: None,
            permissions: Vec::new(),
            rate_limit: None,
            archived: false,
        }
    }
    
    /// Add a query parameter
    pub fn with_query_param(mut self, param: ParamSchema) -> Self {
        self.query_params.push(param);
        self
    }
    
    /// Set the request body shape
    pub fn with_request_body(mut self, shape: DataShape) -> Self {
        self.request_body = Some(shape);
        self
    }
    
    /// Set the response body shape
    pub fn with_response_body(mut self, shape: DataShape) -> Self {
        self.response_body = Some(shape);
        self
    }
    
    /// Link to a logic flow
    pub fn with_logic_flow(mut self, flow_id: impl Into<String>) -> Self {
        self.logic_flow_id = Some(flow_id.into());
        self
    }
    
    /// Add a required permission
    pub fn with_permission(mut self, permission: impl Into<String>) -> Self {
        self.permissions.push(permission.into());
        self
    }
}

impl DataShape {
    /// Create an object shape
    pub fn object(fields: Vec<ShapeField>) -> Self {
        Self {
            shape_type: ShapeType::Object,
            fields: Some(fields),
            item_shape: None,
            model_ref: None,
        }
    }
    
    /// Create an array shape
    pub fn array(item_shape: DataShape) -> Self {
        Self {
            shape_type: ShapeType::Array,
            fields: None,
            item_shape: Some(Box::new(item_shape)),
            model_ref: None,
        }
    }
    
    /// Create a model reference shape
    pub fn model(model_id: impl Into<String>) -> Self {
        Self {
            shape_type: ShapeType::Model,
            fields: None,
            item_shape: None,
            model_ref: Some(model_id.into()),
        }
    }
    
    /// Create a primitive shape
    pub fn primitive(shape_type: ShapeType) -> Self {
        Self {
            shape_type,
            fields: None,
            item_shape: None,
            model_ref: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_api() {
        let api = ApiSchema::new("api-1", HttpMethod::Get, "/users", "Get Users");
        assert_eq!(api.id, "api-1");
        assert_eq!(api.method, HttpMethod::Get);
        assert_eq!(api.path, "/users");
        assert!(!api.archived);
    }
    
    #[test]
    fn test_api_builder() {
        let api = ApiSchema::new("api-2", HttpMethod::Post, "/users", "Create User")
            .with_permission("admin")
            .with_logic_flow("flow-1");
            
        assert_eq!(api.permissions.len(), 1);
        assert!(api.logic_flow_id.is_some());
    }
    
    #[test]
    fn test_data_shape_object() {
        let shape = DataShape::object(vec![
            ShapeField {
                name: "email".into(),
                field_type: ShapeType::String,
                required: true,
                nested: None,
            }
        ]);
        assert_eq!(shape.shape_type, ShapeType::Object);
        assert!(shape.fields.is_some());
    }
}
