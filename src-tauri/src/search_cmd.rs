// Search commands module - Tauri command implementations for search and content retrieval
use std::collections::LinkedList;
use tauri::command;

use crate::error::IntoStringResult;
use crate::mdict_app::{with_read_access, with_write_access};

/// Incremental search (index search)
#[command]
pub async fn search_search_incremental(query: String, max_results: Option<usize>) -> std::result::Result<serde_json::Value, String> {
    let max_results = max_results.unwrap_or(50);
    
    with_write_access(|app| {
        match app.incremental_search(&query, max_results)? {
            Some((start_entry, total_count)) => {
                Ok(serde_json::json!({
                    "start_entry_no": start_entry,
                    "total_count": total_count
                }))
            }
            None => {
                // Return {start_entry_no: -1, total_count: 0} to indicate no results found
                Ok(serde_json::json!({
                    "start_entry_no": -1,
                    "total_count": 0
                }))
            }
        }
    }).into_string_result()
}

/// Get content URL for an entry by index number
#[command]
pub async fn search_get_content_url(index_no: usize) -> std::result::Result<String, String> {
    with_read_access(|app| app.get_content_url(index_no)).into_string_result()
}

/// Get total entry count
#[command]
pub async fn search_get_entry_count() -> std::result::Result<usize, String> {
    with_read_access(|app| app.get_entry_count()).into_string_result()
}

/// Find index by keyword
#[command]
pub async fn search_find_index(key: String) -> std::result::Result<serde_json::Value, String> {
    with_write_access(|app| {
        let group_indexes = app.find_index(&key)?;
        
        // Convert LinkedList<MdxGroupIndex> to JSON array
        let mut result = Vec::new();
        for group_index in group_indexes {
            result.push(serde_json::json!({
                "profile_id": group_index.profile_id,
                "primary_key": group_index.primary_key,
                "indexes": group_index.indexes.iter().map(|idx| serde_json::json!({
                    "profile_id": idx.profile_id,
                    "entry_no": idx.key_index.entry_no,
                    "key": idx.key_index.key
                })).collect::<Vec<_>>()
            }));
        }
        
        Ok(serde_json::Value::Array(result))
    }).into_string_result()
}

/// Fulltext search (across single database or dictionary group)
#[command]
pub async fn search_fulltext_search(query: String, max_results: Option<usize>) -> std::result::Result<serde_json::Value, String> {
    let max_results = max_results.unwrap_or(200);
    with_write_access(|app| {
        let total = app.fulltext_search(&query, max_results)?;
        Ok(serde_json::json!({
            "start_entry_no": 0,
            "total_count": total
        }))
    }).into_string_result()
}

/// Get result key list (paginated search results)
#[command]
pub async fn search_get_result_key_list(start_index_no: i64, max_count: usize) -> std::result::Result<LinkedList<(String, usize)>, String> {
    with_write_access(|app| app.get_result_key_list(start_index_no, max_count)).into_string_result()
}

/// Get group indexes for a given index number
#[command]
pub async fn search_get_group_indexes(index_no: usize) -> std::result::Result<serde_json::Value, String> {
    with_write_access(|app| {
        let group_indexes = app.get_group_indexes(index_no)?;
        
        // Convert LinkedList<MdxGroupIndex> to JSON array
        let mut result = Vec::new();
        for group_index in group_indexes {
            result.push(serde_json::json!({
                "profile_id": group_index.profile_id,
                "primary_key": group_index.primary_key,
                "indexes": group_index.indexes.iter().map(|idx| serde_json::json!({
                    "profile_id": idx.profile_id,
                    "entry_no": idx.key_index.entry_no,
                    "key": idx.key_index.key
                })).collect::<Vec<_>>()
            }));
        }
        
        Ok(serde_json::Value::Array(result))
    }).into_string_result()
}

