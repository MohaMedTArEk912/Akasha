//! Schema module - The source of truth for all data structures
//! 
//! This module contains all schema definitions used throughout the IDE:
//! - BlockSchema: UI component definitions
//! - ApiSchema: Backend endpoint definitions  
//! - DataModelSchema: Database model definitions
//! - LogicFlowSchema: Visual logic/event definitions
//! - ProjectSchema: Master schema tying everything together

pub mod block;
pub mod api;
pub mod data_model;
pub mod logic_flow;
pub mod project;
pub mod variable;
pub mod common;

// Re-export main types
pub use block::{BlockSchema, BlockType};
pub use api::{ApiSchema, HttpMethod};
pub use data_model::DataModelSchema;
pub use logic_flow::LogicFlowSchema;
pub use project::ProjectSchema;
pub use variable::VariableSchema;
pub use common::PageSchema;
