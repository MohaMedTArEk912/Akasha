//! Code Generator module
//! 
//! Generates production-ready code from the project schema:
//! - Frontend: React + Tailwind
//! - Backend: NestJS + Prisma
//! - Database: SQL migrations

pub mod frontend;
pub mod backend;
pub mod database;

// Re-exports
pub use frontend::FrontendGenerator;
pub use backend::BackendGenerator;
pub use database::DatabaseGenerator;
