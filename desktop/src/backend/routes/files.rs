//! File system routes - CRUD operations for project files
//!
//! Provides endpoints for listing, creating, renaming, and deleting files/folders
//! in the project's root directory.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::backend::error::ApiError;
use crate::backend::state::AppState;

/// File/folder entry in directory listing
#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

/// Directory listing response
#[derive(Debug, Serialize)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
}

/// Query params for listing directory
#[derive(Debug, Deserialize)]
pub struct ListDirQuery {
    pub path: Option<String>,
}

/// Create file request
#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
    pub content: Option<String>,
}

/// Create folder request
#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    pub path: String,
}

/// Rename request
#[derive(Debug, Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_path: String,
}

/// Delete request
#[derive(Debug, Deserialize)]
pub struct DeleteRequest {
    pub path: String,
}

/// Read file request
#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

/// Write file request
#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

/// Read file response
#[derive(Debug, Serialize)]
pub struct FileContentResponse {
    pub content: String,
    pub path: String,
}

/// Resolve and validate project root as a canonical directory path.
fn canonical_project_root(root_path: &str) -> Result<PathBuf, ApiError> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|e| ApiError::Internal(format!("Failed to resolve root path: {}", e)))?;

    if !root.is_dir() {
        return Err(ApiError::BadRequest(
            "Project root path is not a directory".into(),
        ));
    }

    Ok(root)
}

/// Normalize user path into a clean relative path under the project root.
fn normalize_relative_path(user_path: &str) -> Result<PathBuf, ApiError> {
    if user_path.contains('\0') {
        return Err(ApiError::BadRequest(
            "Path contains invalid null byte".into(),
        ));
    }

    let sanitized = user_path.trim().replace('\\', "/");
    if sanitized.is_empty() {
        return Ok(PathBuf::new());
    }

    let raw_path = Path::new(&sanitized);
    if raw_path.is_absolute() {
        return Err(ApiError::BadRequest(
            "Path must be relative to project root".into(),
        ));
    }

    // Normalize manually to reject traversal and platform-specific absolute components.
    let mut normalized = PathBuf::new();
    for component in raw_path.components() {
        match component {
            Component::Normal(segment) => normalized.push(segment),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err(ApiError::BadRequest("Path escapes project root".into()));
                }
            }
            _ => {
                return Err(ApiError::BadRequest(
                    "Path must be relative to project root".into(),
                ));
            }
        }
    }

    Ok(normalized)
}

/// Validate that a resolved path stays within the project root to prevent traversal and
/// symlink escapes. Returns an absolute normalized path rooted at `canon_root`.
fn validate_path(canon_root: &Path, user_path: &str) -> Result<PathBuf, ApiError> {
    let relative = normalize_relative_path(user_path)?;
    let target = canon_root.join(&relative);

    // Resolve nearest existing ancestor to block symlink escapes for paths that do not
    // exist yet. Example blocked: root/link_to_outside/new.txt
    let mut probe = target.clone();
    while !probe.exists() {
        if !probe.pop() {
            return Err(ApiError::BadRequest("Path escapes project root".into()));
        }
    }

    let canon_probe = probe
        .canonicalize()
        .map_err(|e| ApiError::Internal(format!("Failed to resolve path: {}", e)))?;
    if !canon_probe.starts_with(canon_root) {
        return Err(ApiError::BadRequest("Path escapes project root".into()));
    }

    // Return the requested in-root path (not canonical target path) so file operations
    // operate on the requested entry (e.g. symlink rename/delete), while remaining safe.
    Ok(target)
}

fn ensure_not_root(target: &Path, canon_root: &Path) -> Result<(), ApiError> {
    if target == canon_root {
        return Err(ApiError::BadRequest(
            "Path cannot target project root".into(),
        ));
    }
    Ok(())
}

fn to_relative_path(canon_root: &Path, target: &Path) -> Result<String, ApiError> {
    target
        .strip_prefix(canon_root)
        .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
        .map_err(|_| ApiError::Internal("Failed to compute project-relative path".into()))
}

fn normalized_request_path_or_root(path: Option<&str>) -> Result<Option<PathBuf>, ApiError> {
    match path.map(str::trim) {
        Some(raw) if !raw.is_empty() => Ok(Some(normalize_relative_path(raw)?)),
        _ => Ok(None),
    }
}

fn extension_for_name(name: &str, is_directory: bool) -> Option<String> {
    if is_directory {
        None
    } else {
        Path::new(name)
            .extension()
            .map(|e| e.to_string_lossy().to_string())
    }
}

fn safe_file_name(path: &Path) -> Result<String, ApiError> {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| ApiError::BadRequest("Path must reference a file or folder name".into()))
}

/// List directory contents
pub async fn list_directory(
    State(state): State<AppState>,
    Query(query): Query<ListDirQuery>,
) -> Result<Json<DirectoryListing>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    // Determine the directory to list (with path traversal and symlink protection).
    let target_path = match normalized_request_path_or_root(query.path.as_deref())? {
        Some(relative) => validate_path(&canon_root, relative.to_string_lossy().as_ref())?,
        None => canon_root.clone(),
    };

    if !target_path.exists() {
        return Err(ApiError::NotFound(format!(
            "Directory not found: {}",
            to_relative_path(&canon_root, &target_path)?
        )));
    }

    if !target_path.is_dir() {
        return Err(ApiError::BadRequest("Path is not a directory".into()));
    }

    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = fs::read_dir(&target_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read directory: {}", e)))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| ApiError::Internal(format!("Failed to read entry: {}", e)))?;
        let metadata = entry
            .metadata()
            .map_err(|e| ApiError::Internal(format!("Failed to read metadata: {}", e)))?;

        let name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path();
        let is_directory = metadata.is_dir();

        entries.push(FileEntry {
            name: name.clone(),
            path: to_relative_path(&canon_root, &full_path)?,
            is_directory,
            size: if is_directory {
                None
            } else {
                Some(metadata.len())
            },
            extension: extension_for_name(&name, is_directory),
        });
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(Json(DirectoryListing {
        path: to_relative_path(&canon_root, &target_path)?,
        entries,
    }))
}

/// Create a new file
pub async fn create_file(
    State(state): State<AppState>,
    Json(req): Json<CreateFileRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let file_path = validate_path(&canon_root, &req.path)?;
    ensure_not_root(&file_path, &canon_root)?;

    if file_path.exists() {
        return Err(ApiError::BadRequest("Path already exists".into()));
    }

    // Create parent directories if needed.
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            ApiError::Internal(format!("Failed to create parent directories: {}", e))
        })?;
    }

    // Write content (empty if not provided).
    let content = req.content.unwrap_or_default();
    fs::write(&file_path, &content)
        .map_err(|e| ApiError::Internal(format!("Failed to create file: {}", e)))?;

    let name = safe_file_name(&file_path)?;

    Ok(Json(FileEntry {
        name: name.clone(),
        path: to_relative_path(&canon_root, &file_path)?,
        is_directory: false,
        size: Some(content.len() as u64),
        extension: extension_for_name(&name, false),
    }))
}

/// Create a new folder
pub async fn create_folder(
    State(state): State<AppState>,
    Json(req): Json<CreateFolderRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let folder_path = validate_path(&canon_root, &req.path)?;
    ensure_not_root(&folder_path, &canon_root)?;

    if folder_path.exists() {
        return Err(ApiError::BadRequest("Path already exists".into()));
    }

    fs::create_dir_all(&folder_path)
        .map_err(|e| ApiError::Internal(format!("Failed to create folder: {}", e)))?;

    let name = safe_file_name(&folder_path)?;

    Ok(Json(FileEntry {
        name,
        path: to_relative_path(&canon_root, &folder_path)?,
        is_directory: true,
        size: None,
        extension: None,
    }))
}

/// Rename a file or folder
pub async fn rename_file(
    State(state): State<AppState>,
    Json(req): Json<RenameRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let old_path = validate_path(&canon_root, &req.old_path)?;
    let new_path = validate_path(&canon_root, &req.new_path)?;
    ensure_not_root(&old_path, &canon_root)?;
    ensure_not_root(&new_path, &canon_root)?;

    if old_path == new_path {
        return Err(ApiError::BadRequest(
            "Source and destination paths are the same".into(),
        ));
    }

    if !old_path.exists() {
        return Err(ApiError::NotFound("Source file/folder not found".into()));
    }

    if new_path.exists() {
        return Err(ApiError::BadRequest("Destination already exists".into()));
    }

    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            ApiError::Internal(format!(
                "Failed to create destination parent directories: {}",
                e
            ))
        })?;
    }

    fs::rename(&old_path, &new_path)
        .map_err(|e| ApiError::Internal(format!("Failed to rename: {}", e)))?;

    let metadata = fs::metadata(&new_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read metadata: {}", e)))?;

    let name = safe_file_name(&new_path)?;
    let is_directory = metadata.is_dir();

    Ok(Json(FileEntry {
        name: name.clone(),
        path: to_relative_path(&canon_root, &new_path)?,
        is_directory,
        size: if is_directory {
            None
        } else {
            Some(metadata.len())
        },
        extension: extension_for_name(&name, is_directory),
    }))
}

/// Delete a file or folder
pub async fn delete_file(
    State(state): State<AppState>,
    Json(req): Json<DeleteRequest>,
) -> Result<Json<bool>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let target_path = validate_path(&canon_root, &req.path)?;
    ensure_not_root(&target_path, &canon_root)?;

    if !target_path.exists() {
        return Err(ApiError::NotFound("File/folder not found".into()));
    }

    if target_path.is_dir() {
        fs::remove_dir_all(&target_path)
            .map_err(|e| ApiError::Internal(format!("Failed to delete folder: {}", e)))?;
    } else {
        fs::remove_file(&target_path)
            .map_err(|e| ApiError::Internal(format!("Failed to delete file: {}", e)))?;
    }

    Ok(Json(true))
}

/// Read file content
pub async fn read_file(
    State(state): State<AppState>,
    Query(query): Query<ReadFileQuery>,
) -> Result<Json<FileContentResponse>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let file_path = validate_path(&canon_root, &query.path)?;
    ensure_not_root(&file_path, &canon_root)?;

    if !file_path.exists() {
        return Err(ApiError::NotFound("File not found".into()));
    }

    if file_path.is_dir() {
        return Err(ApiError::BadRequest(
            "Path is a directory, not a file".into(),
        ));
    }

    let bytes =
        fs::read(&file_path).map_err(|e| ApiError::Internal(format!("Failed to read file: {}", e)))?;
    let content = String::from_utf8(bytes)
        .map_err(|_| ApiError::BadRequest("File is not valid UTF-8 text".into()))?;

    Ok(Json(FileContentResponse {
        content,
        path: to_relative_path(&canon_root, &file_path)?,
    }))
}

/// Write file content
pub async fn write_file(
    State(state): State<AppState>,
    Json(req): Json<WriteFileRequest>,
) -> Result<Json<FileContentResponse>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    let canon_root = canonical_project_root(root_path)?;

    let file_path = validate_path(&canon_root, &req.path)?;
    ensure_not_root(&file_path, &canon_root)?;

    if file_path.is_dir() {
        return Err(ApiError::BadRequest(
            "Path is a directory, not a file".into(),
        ));
    }

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            ApiError::Internal(format!("Failed to create parent directories: {}", e))
        })?;
    }

    fs::write(&file_path, &req.content)
        .map_err(|e| ApiError::Internal(format!("Failed to write file: {}", e)))?;

    Ok(Json(FileContentResponse {
        content: req.content,
        path: to_relative_path(&canon_root, &file_path)?,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn make_temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("grapes-files-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn cleanup_temp_dir(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn normalize_relative_path_rejects_escape() {
        let err = normalize_relative_path("../outside").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn normalize_relative_path_rejects_absolute() {
        let err = normalize_relative_path("/etc/passwd").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn validate_path_normalizes_components() {
        let root = make_temp_dir("normalize");
        let canon_root = canonical_project_root(root.to_str().unwrap()).unwrap();

        let resolved = validate_path(&canon_root, "a/../b/test.txt").unwrap();
        let expected = canon_root.join("b").join("test.txt");
        assert_eq!(resolved, expected);

        cleanup_temp_dir(&root);
    }

    #[test]
    fn ensure_not_root_rejects_root_target() {
        let root = make_temp_dir("no-root");
        let canon_root = canonical_project_root(root.to_str().unwrap()).unwrap();
        let err = ensure_not_root(&canon_root, &canon_root).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
        cleanup_temp_dir(&root);
    }

    #[cfg(unix)]
    #[test]
    fn validate_path_blocks_symlink_escape_for_missing_file() {
        use std::os::unix::fs::symlink;

        let root = make_temp_dir("root");
        let outside = make_temp_dir("outside");
        let link = root.join("linked");
        symlink(&outside, &link).unwrap();

        let canon_root = canonical_project_root(root.to_str().unwrap()).unwrap();
        let err = validate_path(&canon_root, "linked/secret.txt").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));

        cleanup_temp_dir(&root);
        cleanup_temp_dir(&outside);
    }

    #[cfg(unix)]
    #[test]
    fn validate_path_keeps_in_root_symlink_path() {
        use std::os::unix::fs::symlink;

        let root = make_temp_dir("symlink-path");
        let real_dir = root.join("real-dir");
        fs::create_dir_all(&real_dir).unwrap();
        let link = root.join("link-dir");
        symlink(&real_dir, &link).unwrap();

        let canon_root = canonical_project_root(root.to_str().unwrap()).unwrap();
        let resolved = validate_path(&canon_root, "link-dir").unwrap();
        assert_eq!(resolved, canon_root.join("link-dir"));

        cleanup_temp_dir(&root);
    }
}
