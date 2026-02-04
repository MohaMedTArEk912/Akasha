//! Command Log - Manages command history for undo/redo

use std::collections::VecDeque;
use super::Command;

/// Maximum number of commands to keep in history
const MAX_HISTORY_SIZE: usize = 100;

/// Command log for undo/redo functionality
pub struct CommandLog {
    /// Past commands (can be undone)
    history: VecDeque<Box<dyn Command>>,
    
    /// Future commands (can be redone after undo)
    future: Vec<Box<dyn Command>>,
}

impl CommandLog {
    /// Create a new empty command log
    pub fn new() -> Self {
        Self {
            history: VecDeque::with_capacity(MAX_HISTORY_SIZE),
            future: Vec::new(),
        }
    }
    
    /// Execute a command and add it to history
    pub fn execute(&mut self, command: Box<dyn Command>) -> Result<(), String> {
        command.execute().map_err(|e| e.to_string())?;
        
        // Clear future when new command is executed
        self.future.clear();
        
        // Add to history
        if self.history.len() >= MAX_HISTORY_SIZE {
            self.history.pop_front();
        }
        self.history.push_back(command);
        
        Ok(())
    }
    
    /// Undo the last command
    pub fn undo(&mut self) -> Result<String, String> {
        if let Some(command) = self.history.pop_back() {
            command.undo().map_err(|e| e.to_string())?;
            let desc = command.description();
            self.future.push(command);
            Ok(desc)
        } else {
            Err("Nothing to undo".into())
        }
    }
    
    /// Redo the last undone command
    pub fn redo(&mut self) -> Result<String, String> {
        if let Some(command) = self.future.pop() {
            command.execute().map_err(|e| e.to_string())?;
            let desc = command.description();
            self.history.push_back(command);
            Ok(desc)
        } else {
            Err("Nothing to redo".into())
        }
    }
    
    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.history.is_empty()
    }
    
    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.future.is_empty()
    }
    
    /// Get the description of the next undo action
    pub fn undo_description(&self) -> Option<String> {
        self.history.back().map(|c| c.description())
    }
    
    /// Get the description of the next redo action
    pub fn redo_description(&self) -> Option<String> {
        self.future.last().map(|c| c.description())
    }
}

impl Default for CommandLog {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::CommandResult;
    
    // Simple test command
    struct TestCommand {
        executed: std::sync::Arc<std::sync::atomic::AtomicBool>,
    }
    
    impl Command for TestCommand {
        fn execute(&self) -> CommandResult<()> {
            self.executed.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        }
        
        fn undo(&self) -> CommandResult<()> {
            self.executed.store(false, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        }
        
        fn description(&self) -> String {
            "Test command".into()
        }
    }
    
    #[test]
    fn test_command_log() {
        let mut log = CommandLog::new();
        let executed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        
        let cmd = TestCommand { executed: executed.clone() };
        log.execute(Box::new(cmd)).unwrap();
        
        assert!(executed.load(std::sync::atomic::Ordering::SeqCst));
        assert!(log.can_undo());
        
        log.undo().unwrap();
        assert!(!executed.load(std::sync::atomic::Ordering::SeqCst));
        assert!(log.can_redo());
    }
}
