// Re-export ZdbError for convenience
pub use mdx::{ZdbError, Result};

// Type alias for backward compatibility
pub type MdictAppError = ZdbError;

/// Helper trait for converting Result<T> to Result<T, String>
/// Used by Tauri commands to convert errors to strings
pub trait IntoStringResult<T> {
    fn into_string_result(self) -> std::result::Result<T, String>;
}

impl<T> IntoStringResult<T> for Result<T> {
    fn into_string_result(self) -> std::result::Result<T, String> {
        self.map_err(|e| crate::error_printer::format_error(&e))
    }
}