//! Commands module - Command Pattern implementation
//! 
//! All state mutations go through commands, enabling undo/redo.

pub mod block_commands;
pub mod api_commands;
pub mod command_log;

use thiserror::Error;

/// Command error types
#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Entity not found: {0}")]
    NotFound(String),
    
    #[error("Validation failed: {0}")]
    ValidationError(String),
    
    #[error("State lock failed")]
    LockFailed,
    
    #[error("Command execution failed: {0}")]
    ExecutionError(String),
}

/// Result type for commands
pub type CommandResult<T> = Result<T, CommandError>;

/// Trait for all commands
pub trait Command: Send + Sync {
    /// Execute the command
    fn execute(&self) -> CommandResult<()>;
    
    /// Undo the command
    fn undo(&self) -> CommandResult<()>;
    
    /// Get a description of this command for UI
    fn description(&self) -> String;
}
