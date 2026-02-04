//! Virtual File System (VFS) module
//! 
//! The VFS presents schema entities as virtual files in a tree structure.
//! Files are not real files on disk - they are views into the schema.

pub mod file_tree;

pub use file_tree::{VirtualFile, VirtualFileType, build_file_tree};
