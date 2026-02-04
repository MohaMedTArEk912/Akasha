//! Data Model Schema - Database model definitions
//! 
//! Data models represent database tables/collections that compile to
//! Prisma schema and SQL migrations.

use serde::{Deserialize, Serialize};

/// Data Model Schema - represents a database model/table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataModelSchema {
    /// Unique identifier (UUID v4)
    pub id: String,
    
    /// Model name (PascalCase, e.g., "User", "Product")
    pub name: String,
    
    /// Description of what this model represents
    pub description: Option<String>,
    
    /// Fields in this model
    pub fields: Vec<FieldSchema>,
    
    /// Relations to other models
    pub relations: Vec<RelationSchema>,
    
    /// Indexes for this model
    pub indexes: Vec<IndexSchema>,
    
    /// Whether timestamps (createdAt, updatedAt) should be auto-added
    pub timestamps: bool,
    
    /// Whether soft delete should be enabled
    pub soft_delete: bool,
    
    /// Whether this model is archived (soft deleted in IDE)
    pub archived: bool,
}

/// Field schema - represents a column in the model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSchema {
    /// Unique identifier
    pub id: String,
    
    /// Field name (camelCase)
    pub name: String,
    
    /// Field data type
    pub field_type: FieldType,
    
    /// Whether this field is required
    pub required: bool,
    
    /// Whether this field is unique
    pub unique: bool,
    
    /// Whether this is the primary key
    pub primary_key: bool,
    
    /// Default value expression
    pub default_value: Option<DefaultValue>,
    
    /// Validation rules
    pub validations: Vec<FieldValidation>,
    
    /// Description/comment
    pub description: Option<String>,
}

/// Available field types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FieldType {
    // Scalar types
    String,
    Int,
    Float,
    Boolean,
    DateTime,
    Json,
    
    // Special types
    Uuid,
    Email,
    Url,
    
    // Binary/Large data
    Bytes,
    Text, // Long text
}

/// Default value configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DefaultValue {
    /// Static value
    Static { value: String },
    
    /// Auto-increment
    AutoIncrement,
    
    /// UUID v4
    Uuid,
    
    /// Current timestamp
    Now,
    
    /// Custom expression (for advanced users)
    Expression { expr: String },
}

/// Field validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldValidation {
    MinLength { value: u32 },
    MaxLength { value: u32 },
    Min { value: f64 },
    Max { value: f64 },
    Pattern { regex: String, message: Option<String> },
    Enum { values: Vec<String> },
}

/// Relation schema - represents a relationship between models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationSchema {
    /// Unique identifier
    pub id: String,
    
    /// Relation name (field name in this model)
    pub name: String,
    
    /// Type of relation
    pub relation_type: RelationType,
    
    /// Target model ID
    pub target_model_id: String,
    
    /// Foreign key field name (in this or target model depending on relation type)
    pub foreign_key: Option<String>,
    
    /// On delete behavior
    pub on_delete: OnDeleteAction,
    
    /// On update behavior
    pub on_update: OnUpdateAction,
}

/// Relation types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RelationType {
    /// One record relates to one record (e.g., User has one Profile)
    OneToOne,
    
    /// One record relates to many records (e.g., User has many Posts)
    OneToMany,
    
    /// Many records relate to one record (inverse of OneToMany)
    ManyToOne,
    
    /// Many records relate to many records (requires junction table)
    ManyToMany,
}

/// On delete actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OnDeleteAction {
    Cascade,
    SetNull,
    Restrict,
    NoAction,
}

/// On update actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OnUpdateAction {
    Cascade,
    SetNull,
    Restrict,
    NoAction,
}

/// Index schema - represents a database index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSchema {
    /// Unique identifier
    pub id: String,
    
    /// Index name
    pub name: String,
    
    /// Fields included in this index
    pub fields: Vec<String>,
    
    /// Whether this is a unique index
    pub unique: bool,
}

impl DataModelSchema {
    /// Create a new data model
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `name` - Model name (PascalCase)
    /// 
    /// # Returns
    /// A new DataModelSchema with default values
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        let id_str = id.into();
        let name_str = name.into();
        
        // Create default id field
        let id_field = FieldSchema {
            id: format!("{}-id", &id_str),
            name: "id".into(),
            field_type: FieldType::Uuid,
            required: true,
            unique: true,
            primary_key: true,
            default_value: Some(DefaultValue::Uuid),
            validations: Vec::new(),
            description: Some("Primary key".into()),
        };
        
        Self {
            id: id_str,
            name: name_str,
            description: None,
            fields: vec![id_field],
            relations: Vec::new(),
            indexes: Vec::new(),
            timestamps: true,
            soft_delete: false,
            archived: false,
        }
    }
    
    /// Add a field to the model
    pub fn with_field(mut self, field: FieldSchema) -> Self {
        self.fields.push(field);
        self
    }
    
    /// Add a relation to the model
    pub fn with_relation(mut self, relation: RelationSchema) -> Self {
        self.relations.push(relation);
        self
    }
    
    /// Enable soft delete
    pub fn with_soft_delete(mut self) -> Self {
        self.soft_delete = true;
        self
    }
}

impl FieldSchema {
    /// Create a new simple field
    /// 
    /// # Arguments
    /// * `id` - Unique identifier
    /// * `name` - Field name
    /// * `field_type` - Data type
    /// 
    /// # Returns
    /// A new FieldSchema with sensible defaults
    pub fn new(id: impl Into<String>, name: impl Into<String>, field_type: FieldType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            field_type,
            required: true,
            unique: false,
            primary_key: false,
            default_value: None,
            validations: Vec::new(),
            description: None,
        }
    }
    
    /// Make this field optional
    pub fn optional(mut self) -> Self {
        self.required = false;
        self
    }
    
    /// Make this field unique
    pub fn unique(mut self) -> Self {
        self.unique = true;
        self
    }
    
    /// Set a default value
    pub fn with_default(mut self, default: DefaultValue) -> Self {
        self.default_value = Some(default);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_model() {
        let model = DataModelSchema::new("model-1", "User");
        assert_eq!(model.id, "model-1");
        assert_eq!(model.name, "User");
        assert!(!model.archived);
        assert!(model.timestamps);
        // Should have default id field
        assert_eq!(model.fields.len(), 1);
        assert_eq!(model.fields[0].name, "id");
    }
    
    #[test]
    fn test_model_with_fields() {
        let model = DataModelSchema::new("model-2", "Product")
            .with_field(FieldSchema::new("f1", "name", FieldType::String))
            .with_field(FieldSchema::new("f2", "price", FieldType::Float).optional())
            .with_soft_delete();
            
        assert_eq!(model.fields.len(), 3); // id + name + price
        assert!(model.soft_delete);
    }
    
    #[test]
    fn test_field_builder() {
        let field = FieldSchema::new("f1", "email", FieldType::Email)
            .unique()
            .optional();
            
        assert!(field.unique);
        assert!(!field.required);
    }
}
