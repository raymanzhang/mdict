// Favorites commands module - Tauri command implementations for favorites management
use tauri::command;

use crate::error::IntoStringResult;
use crate::favorites::{FavoriteEntry, FavoriteSortBy};
use crate::mdict_app::{with_favorites_read, with_favorites_write};

/// Add a favorite entry
#[command]
pub async fn favorites_add_favorite(
    keyword: String,
    group_index: serde_json::Value,
    profile_id: i32,
    profile_name: String,
) -> std::result::Result<FavoriteEntry, String> {
    with_favorites_write(|manager| {
        manager.add_favorite(keyword, group_index, profile_id, profile_name)
    }).into_string_result()
}

/// Remove a favorite entry by ID
#[command]
pub async fn favorites_remove_favorite(
    id: String,
) -> std::result::Result<bool, String> {
    with_favorites_write(|manager| {
        manager.remove_favorite(&id)
    }).into_string_result()
}

/// Toggle favorite (add if not exists, remove if exists)
#[command]
pub async fn favorites_toggle_favorite(
    keyword: String,
    group_index: serde_json::Value,
    profile_id: i32,
    profile_name: String,
) -> std::result::Result<bool, String> {
    with_favorites_write(|manager| {
        let (added, _) = manager.toggle_favorite(keyword, group_index, profile_id, profile_name)?;
        Ok(added)
    }).into_string_result()
}

/// Check if favorited
#[command]
pub async fn favorites_is_favorited(
    keyword: String,
    profile_id: i32,
) -> std::result::Result<bool, String> {
    with_favorites_read(|manager| {
        manager.is_favorited(&keyword, profile_id)
    }).into_string_result()
}

/// Get sorted and filtered favorites
#[command]
pub async fn favorites_get_sorted_and_filtered_favorites(
    sort_by: FavoriteSortBy,
    filter_profile_id: Option<i32>,
) -> std::result::Result<Vec<FavoriteEntry>, String> {
    with_favorites_read(|manager| {
        manager.get_sorted_and_filtered_favorites(sort_by, filter_profile_id)
    }).into_string_result()
}

/// Get all favorites
#[command]
pub async fn favorites_get_all_favorites() -> std::result::Result<Vec<FavoriteEntry>, String> {
    with_favorites_read(|manager| {
        manager.get_all_favorites()
    }).into_string_result()
}

/// Clear all favorites
#[command]
pub async fn favorites_clear_all_favorites() -> std::result::Result<(), String> {
    with_favorites_write(|manager| {
        manager.clear_all_favorites()
    }).into_string_result()
}

/// Import favorites (for backup/restore)
#[command]
pub async fn favorites_import_favorites(
    entries: Vec<FavoriteEntry>,
) -> std::result::Result<(), String> {
    with_favorites_write(|manager| {
        manager.import_favorites(entries)
    }).into_string_result()
}

/// Get favorites count
#[command]
pub async fn favorites_get_favorites_count() -> std::result::Result<usize, String> {
    with_favorites_read(|manager| {
        manager.get_favorites_count()
    }).into_string_result()
}

