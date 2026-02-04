//! API commands - Commands for API endpoint operations

use std::sync::{Arc, Mutex};

use super::{Command, CommandError, CommandResult};
use crate::schema::{ApiSchema, HttpMethod, ProjectSchema};

/// Add a new API endpoint
pub struct AddApiCommand {
    pub state: Arc<Mutex<Option<ProjectSchema>>>,
    pub api_id: String,
    pub method: String,
    pub path: String,
    pub name: String,
}

impl Command for AddApiCommand {
    fn execute(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        let method = parse_http_method(&self.method)?;
        let api = ApiSchema::new(&self.api_id, method, self.path.clone(), self.name.clone());
        project.add_api(api);
        Ok(())
    }
    
    fn undo(&self) -> CommandResult<()> {
        let mut state_lock = self.state.lock().map_err(|_| CommandError::LockFailed)?;
        let project = state_lock.as_mut().ok_or_else(|| CommandError::ExecutionError("No project open".into()))?;

        if let Some(api) = project.apis.iter_mut().find(|a| a.id == self.api_id) {
            api.archived = true;
            project.touch();
            Ok(())
        } else {
            Err(CommandError::NotFound(self.api_id.clone()))
        }
    }
    
    fn description(&self) -> String {
        format!("Add {} {}", self.method, self.path)
    }
}

fn parse_http_method(value: &str) -> CommandResult<HttpMethod> {
    match value.to_uppercase().as_str() {
        "GET" => Ok(HttpMethod::Get),
        "POST" => Ok(HttpMethod::Post),
        "PUT" => Ok(HttpMethod::Put),
        "PATCH" => Ok(HttpMethod::Patch),
        "DELETE" => Ok(HttpMethod::Delete),
        _ => Err(CommandError::ValidationError(format!("Unknown HTTP method: {}", value))),
    }
}
