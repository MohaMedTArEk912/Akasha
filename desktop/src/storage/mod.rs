//! Storage module
//! 
//! Handles local SQLite storage for project persistence.

use rusqlite::{Connection, Result};
use std::path::Path;

/// SQLite storage manager
pub struct Storage {
    conn: Connection,
}

impl Storage {
    /// Open or create a storage database
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        let storage = Self { conn };
        storage.init_schema()?;
        Ok(storage)
    }
    
    /// Open an in-memory database (for testing)
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let storage = Self { conn };
        storage.init_schema()?;
        Ok(storage)
    }
    
    /// Initialize the database schema
    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_projects_updated 
            ON projects(updated_at DESC);
        "#)?;
        
        Ok(())
    }
    
    /// Save a project
    pub fn save_project(&self, id: &str, name: &str, data: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        
        self.conn.execute(
            r#"
            INSERT INTO projects (id, name, data, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?4)
            ON CONFLICT(id) DO UPDATE SET
                name = ?2,
                data = ?3,
                updated_at = ?4
            "#,
            [id, name, data, &now],
        )?;
        
        Ok(())
    }
    
    /// Load a project by ID
    pub fn load_project(&self, id: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT data FROM projects WHERE id = ?1")?;
        let mut rows = stmt.query([id])?;
        
        if let Some(row) = rows.next()? {
            let data: String = row.get(0)?;
            Ok(Some(data))
        } else {
            Ok(None)
        }
    }
    
    /// List all projects (returns id, name, updated_at)
    pub fn list_projects(&self) -> Result<Vec<ProjectInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC"
        )?;
        
        let projects = stmt.query_map([], |row| {
            Ok(ProjectInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;
        
        projects.collect()
    }
    
    /// Delete a project
    pub fn delete_project(&self, id: &str) -> Result<bool> {
        let count = self.conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
        Ok(count > 0)
    }
    
    /// Get a setting value
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;
        
        if let Some(row) = rows.next()? {
            let value: String = row.get(0)?;
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }
    
    /// Set a setting value
    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            [key, value],
        )?;
        Ok(())
    }
}

/// Project metadata for listing
#[derive(Debug)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_operations() {
        let storage = Storage::open_in_memory().unwrap();
        
        // Save a project
        storage.save_project("p1", "Test Project", r#"{"id":"p1"}"#).unwrap();
        
        // Load it back
        let data = storage.load_project("p1").unwrap();
        assert!(data.is_some());
        assert!(data.unwrap().contains("p1"));
        
        // List projects
        let projects = storage.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "Test Project");
        
        // Delete project
        let deleted = storage.delete_project("p1").unwrap();
        assert!(deleted);
        
        // Should be gone
        let data = storage.load_project("p1").unwrap();
        assert!(data.is_none());
    }
    
    #[test]
    fn test_settings() {
        let storage = Storage::open_in_memory().unwrap();
        
        storage.set_setting("theme", "dark").unwrap();
        let theme = storage.get_setting("theme").unwrap();
        assert_eq!(theme, Some("dark".into()));
    }
}
