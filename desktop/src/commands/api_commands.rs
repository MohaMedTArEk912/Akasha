//! API commands - Commands for API endpoint operations

use super::{Command, CommandResult};

/// Add a new API endpoint
pub struct AddApiCommand {
    pub api_id: String,
    pub method: String,
    pub path: String,
    pub name: String,
}

impl Command for AddApiCommand {
    fn execute(&self) -> CommandResult<()> {
        // TODO: Implement
        Ok(())
    }
    
    fn undo(&self) -> CommandResult<()> {
        // TODO: Archive the API
        Ok(())
    }
    
    fn description(&self) -> String {
        format!("Add {} {}", self.method, self.path)
    }
}
