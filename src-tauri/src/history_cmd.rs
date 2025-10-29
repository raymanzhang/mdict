// History commands module - Tauri command implementations for history management
use tauri::command;

use crate::error::IntoStringResult;
use crate::history::HistoryEntry;
use crate::mdict_app::{with_history_read, with_history_write};

/// Add a history entry
#[command]
pub async fn history_add_to_history(
    keyword: String,
    group_index: serde_json::Value,
    profile_id: i32,
    profile_name: String,
) -> std::result::Result<HistoryEntry, String> {
    with_history_write(|manager| {
        manager.add_to_history(keyword, group_index, profile_id, profile_name)
    }).into_string_result()
}

/// Get all history entries
#[command]
pub async fn history_get_all_history() -> std::result::Result<Vec<HistoryEntry>, String> {
    with_history_read(|manager| {
        manager.get_all_history()
    }).into_string_result()
}

/// Get history entry by ID
#[command]
pub async fn history_get_history_entry_by_id(
    id: String,
) -> std::result::Result<Option<HistoryEntry>, String> {
    with_history_read(|manager| {
        manager.get_entry_by_id(&id)
    }).into_string_result()
}

/// Remove a history entry by ID
#[command]
pub async fn history_remove_from_history(
    id: String,
) -> std::result::Result<bool, String> {
    with_history_write(|manager| {
        manager.remove_from_history(&id)
    }).into_string_result()
}

/// Clear all history
#[command]
pub async fn history_clear_history() -> std::result::Result<(), String> {
    with_history_write(|manager| {
        manager.clear_history()
    }).into_string_result()
}

/// Get history count
#[command]
pub async fn history_get_history_count() -> std::result::Result<usize, String> {
    with_history_read(|manager| {
        manager.get_history_count()
    }).into_string_result()
}

/// Set maximum history size
#[command]
pub async fn history_set_max_history_size(
    size: usize,
) -> std::result::Result<(), String> {
    with_history_write(|manager| {
        manager.set_max_history_size(size)
    }).into_string_result()
}

/// Get maximum history size
#[command]
pub async fn history_get_max_history_size() -> std::result::Result<usize, String> {
    with_history_read(|manager| {
        Ok(manager.get_max_history_size())
    }).into_string_result()
}

/// Import history entries (for backup/restore)
#[command]
pub async fn history_import_history(
    entries: Vec<HistoryEntry>,
) -> std::result::Result<(), String> {
    with_history_write(|manager| {
        manager.import_history(entries)
    }).into_string_result()
}