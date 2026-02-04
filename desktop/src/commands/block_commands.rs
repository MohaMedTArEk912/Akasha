//! Block commands - Commands for UI block operations

use std::sync::{Arc, Mutex};

use super::{Command, CommandError, CommandResult};
use crate::schema::{BlockSchema, BlockType, ProjectSchema};

/// Add a new block
pub struct AddBlockCommand {
    pub state: Arc<Mutex<Option<ProjectSchema>>>,
    pub block_id: String,
    pub block_type: String,
    pub name: String,
    pub parent_id: Option<String>,
}

impl Command for AddBlockCommand {
    fn execute(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        let block_type_enum = parse_block_type(&self.block_type)?;
        let mut block = BlockSchema::new(&self.block_id, block_type_enum, self.name.clone());

        if let Some(parent_id) = &self.parent_id {
            block.parent_id = Some(parent_id.clone());

            for parent in project.blocks.iter_mut() {
                if parent.id == *parent_id {
                    parent.children.push(self.block_id.clone());
                    break;
                }
            }
        }

        project.add_block(block);
        Ok(())
    }
    
    fn undo(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        if let Some(parent_id) = &self.parent_id {
            for parent in project.blocks.iter_mut() {
                if parent.id == *parent_id {
                    parent.children.retain(|child_id| child_id != &self.block_id);
                    break;
                }
            }
        }

        project.archive_block(&self.block_id);
        Ok(())
    }
    
    fn description(&self) -> String {
        format!("Add {} block", self.name)
    }
}

/// Move a block to a new parent/position
pub struct MoveBlockCommand {
    pub state: Arc<Mutex<Option<ProjectSchema>>>,
    pub block_id: String,
    pub new_parent_id: Option<String>,
    pub new_order: i32,
    // For undo
    pub old_parent_id: Option<String>,
    pub old_order: i32,
}

impl Command for MoveBlockCommand {
    fn execute(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        for parent in project.blocks.iter_mut() {
            if let Some(old_parent_id) = &self.old_parent_id {
                if parent.id == *old_parent_id {
                    parent.children.retain(|child_id| child_id != &self.block_id);
                }
            }

            if let Some(new_parent_id) = &self.new_parent_id {
                if parent.id == *new_parent_id && !parent.children.contains(&self.block_id) {
                    parent.children.push(self.block_id.clone());
                }
            }
        }

        let block = project
            .blocks
            .iter_mut()
            .find(|b| b.id == self.block_id)
            .ok_or_else(|| CommandError::NotFound(self.block_id.clone()))?;

        block.parent_id = self.new_parent_id.clone();
        block.order = self.new_order;
        project.touch();
        Ok(())
    }
    
    fn undo(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        for parent in project.blocks.iter_mut() {
            if let Some(new_parent_id) = &self.new_parent_id {
                if parent.id == *new_parent_id {
                    parent.children.retain(|child_id| child_id != &self.block_id);
                }
            }

            if let Some(old_parent_id) = &self.old_parent_id {
                if parent.id == *old_parent_id && !parent.children.contains(&self.block_id) {
                    parent.children.push(self.block_id.clone());
                }
            }
        }

        let block = project
            .blocks
            .iter_mut()
            .find(|b| b.id == self.block_id)
            .ok_or_else(|| CommandError::NotFound(self.block_id.clone()))?;

        block.parent_id = self.old_parent_id.clone();
        block.order = self.old_order;
        project.touch();
        Ok(())
    }
    
    fn description(&self) -> String {
        "Move block".into()
    }
}

/// Update a block property
pub struct UpdatePropertyCommand {
    pub state: Arc<Mutex<Option<ProjectSchema>>>,
    pub block_id: String,
    pub property: String,
    pub new_value: serde_json::Value,
    pub old_value: Option<serde_json::Value>,
}

impl Command for UpdatePropertyCommand {
    fn execute(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        let block = project
            .find_block_mut(&self.block_id)
            .ok_or_else(|| CommandError::NotFound(self.block_id.clone()))?;

        block.properties.insert(self.property.clone(), self.new_value.clone());
        project.touch();
        Ok(())
    }
    
    fn undo(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        let block = project
            .find_block_mut(&self.block_id)
            .ok_or_else(|| CommandError::NotFound(self.block_id.clone()))?;

        if let Some(old_value) = &self.old_value {
            block.properties.insert(self.property.clone(), old_value.clone());
        } else {
            block.properties.remove(&self.property);
        }

        project.touch();
        Ok(())
    }
    
    fn description(&self) -> String {
        format!("Update {}", self.property)
    }
}

fn parse_block_type(value: &str) -> CommandResult<BlockType> {
    match value.to_lowercase().as_str() {
        "page" => Ok(BlockType::Page),
        "container" => Ok(BlockType::Container),
        "section" => Ok(BlockType::Section),
        "columns" => Ok(BlockType::Columns),
        "column" => Ok(BlockType::Column),
        "flex" => Ok(BlockType::Flex),
        "grid" => Ok(BlockType::Grid),
        "text" => Ok(BlockType::Text),
        "heading" => Ok(BlockType::Heading),
        "paragraph" => Ok(BlockType::Paragraph),
        "link" => Ok(BlockType::Link),
        "image" => Ok(BlockType::Image),
        "video" => Ok(BlockType::Video),
        "icon" => Ok(BlockType::Icon),
        "form" => Ok(BlockType::Form),
        "input" => Ok(BlockType::Input),
        "textarea" => Ok(BlockType::TextArea),
        "select" => Ok(BlockType::Select),
        "checkbox" => Ok(BlockType::Checkbox),
        "radio" => Ok(BlockType::Radio),
        "button" => Ok(BlockType::Button),
        "modal" => Ok(BlockType::Modal),
        "dropdown" => Ok(BlockType::Dropdown),
        "tabs" => Ok(BlockType::Tabs),
        "accordion" => Ok(BlockType::Accordion),
        "list" => Ok(BlockType::List),
        "table" => Ok(BlockType::Table),
        "card" => Ok(BlockType::Card),
        _ => Err(CommandError::ValidationError(format!("Unknown block type: {}", value))),
    }
}
