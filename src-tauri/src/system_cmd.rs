// System commands module - Tauri command implementations for system-level operations
use tauri::command;

use crate::error::IntoStringResult;
use crate::mdict_app::with_write_access;

/// Set base URL for MDX protocol
#[command]
pub async fn system_set_base_url(base_url: String) -> std::result::Result<(), String> {
    with_write_access(|app| app.set_base_url(base_url)).into_string_result()
}
