//! Block routes

use axum::{
    extract::{State, Path},
    Json,
};
use serde::Deserialize;

use crate::{AppState, ApiError};
use crate::schema::{BlockSchema, BlockType};

/// Add block request
#[derive(Debug, Deserialize)]
pub struct AddBlockRequest {
    pub block_type: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// Update block request
#[derive(Debug, Deserialize)]
pub struct UpdateBlockRequest {
    pub property: String,
    pub value: serde_json::Value,
}

/// Add a new block
pub async fn add_block(
    State(state): State<AppState>,
    Json(req): Json<AddBlockRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let block_type = match req.block_type.as_str() {
        "container" => BlockType::Container,
        "text" => BlockType::Text,
        "heading" => BlockType::Heading,
        "button" => BlockType::Button,
        "image" => BlockType::Image,
        "input" => BlockType::Input,
        "form" => BlockType::Form,
        "link" => BlockType::Link,
        "section" => BlockType::Section,
        "columns" => BlockType::Columns,
        "column" => BlockType::Column,
        "flex" => BlockType::Flex,
        "grid" => BlockType::Grid,
        _ => BlockType::Custom(req.block_type.clone()),
    };
    
    let mut block = BlockSchema::new(
        uuid::Uuid::new_v4().to_string(),
        block_type,
        &req.name,
    );
    
    if let Some(parent_id) = req.parent_id {
        block.parent_id = Some(parent_id);
    }
    
    let result = block.clone();
    project.add_block(block);
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Update a block
pub async fn update_block(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateBlockRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let block = project.find_block_mut(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Block {} not found", id)))?;
    
    // Update property based on name
    match req.property.as_str() {
        "name" => {
            if let Some(name) = req.value.as_str() {
                block.name = name.to_string();
            }
        }
        "content" => {
            if let Some(content) = req.value.as_str() {
                block.properties.insert("content".into(), serde_json::json!(content));
            }
        }
        _ => {
            block.properties.insert(req.property.clone(), req.value);
        }
    }
    
    let result = block.clone();
    state.set_project(project).await;
    Ok(Json(result))
}

/// Delete (archive) a block
pub async fn delete_block(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let success = project.archive_block(&id);
    state.set_project(project).await;
    Ok(Json(success))
}
