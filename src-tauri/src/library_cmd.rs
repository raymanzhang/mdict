// Library commands module - Tauri command implementations for library and group management
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::error::{IntoStringResult, ZdbError};
use crate::mdict_app::{with_read_access, with_write_access};
use crate::mdx_profile::ProfileId;

/// Collation options for rebuilding index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollationOptions {
    pub language: String,
    pub collation_type: Option<String>,
    pub strength: String,
    pub alternate_handling: String,
    pub case_level: String,
    pub case_first: String,
}

/// Create a dictionary group
#[command]
pub async fn library_create_dict_group(group_name: String) -> std::result::Result<ProfileId, String> {
    with_write_access(|app| {
        let group = app.library_manager.create_group(group_name);
        let group_id = group.profile_id;
        // Save to file
        app.library_manager.save_library()?;
        Ok(group_id)
    }).into_string_result()
}

/// Delete a dictionary group
#[command]
pub async fn library_delete_dict_group(group_id: ProfileId) -> std::result::Result<bool, String> {
    with_write_access(|app| {
        if app.library_manager.remove_profile(group_id) {
            app.library_manager.save_library()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }).into_string_result()
}

/// Rename a dictionary group
#[command]
pub async fn library_rename_dict_group(group_id: ProfileId, new_name: String) -> std::result::Result<(), String> {
    with_write_access(|app| {
        if let Some(profile) = app.library_manager.get_group_mut(group_id) {
            profile.title = new_name;
            // Save to file
            app.library_manager.save_library()?;
            Ok(())
        } else {
            Err(ZdbError::invalid_parameter("配置文件或组不存在".to_string()))
        }
    }).into_string_result()
}

/// Scan dictionary directory
#[command]
pub async fn library_refresh_library() -> std::result::Result<(), String> {
    with_write_access(|app| {
        let search_paths = app.get_lib_search_paths()?.to_vec();
        app.library_manager.refresh_library(&search_paths)?;
        Ok(())
    }).into_string_result()
}

/// Get group for a given group_id
#[command]
pub async fn library_get_group(group_id: ProfileId) -> std::result::Result<serde_json::Value, String> {
    with_read_access(|app| {
        if let Some(group) = app.library_manager.get_group(group_id) {
            let group_value = serde_json::to_value(group)
                .map_err(|e| ZdbError::invalid_data_format(e.to_string()))?;
            Ok(group_value)
        } else {
            Err(ZdbError::invalid_parameter("词典组不存在".to_string()))
        }
    }).into_string_result()
}

/// Get profile for a given group_id and profile_id
#[command]
pub async fn library_get_profile(parent_group_id: ProfileId, profile_id: ProfileId) -> std::result::Result<serde_json::Value, String> {
    with_read_access(|app| {
        if let Some(profile) = app.library_manager.get_profile(parent_group_id, profile_id) {
            let profile_value = serde_json::to_value(profile)
                .map_err(|e| ZdbError::invalid_data_format(e.to_string()))?;
            Ok(profile_value)
        } else {
            Err(ZdbError::invalid_parameter("词典不存在".to_string()))
        }
    }).into_string_result()
}

/// List all dictionary groups
#[command]
pub async fn library_list_groups() -> std::result::Result<serde_json::Value, String> {
    with_read_access(|app| {
        // Get current main profile ID from main_db
        let current_main_profile_id = app.get_current_main_profile_id()?;

        let groups = app.library_manager.get_groups();
        let mut enhanced_groups = Vec::new();
        
        for group in groups.iter() {
            let mut group_value = serde_json::to_value(group)
                .map_err(|e| ZdbError::invalid_data_format(e.to_string()))?;
            
            // Add is_active flag based on current main profile
            if let Some(obj) = group_value.as_object_mut() {
                obj.insert("isActive".to_string(), 
                    serde_json::Value::Bool(group.profile_id == current_main_profile_id));
            }
            enhanced_groups.push(group_value);
        }
        
        Ok(serde_json::Value::Array(enhanced_groups))
    }).into_string_result()
}

/// Update profile disabled status
#[command]
pub async fn library_update_profile_disabled_status(
    parent_group_id: ProfileId, 
    profile_id: ProfileId, 
    disabled: bool
) -> std::result::Result<(), String> {
    with_write_access(|app| {
        if let Some(group) = app.library_manager.get_group_mut(parent_group_id) {
            if let Some(profile) = group.get_profile_mut(profile_id) {
                profile.disabled = disabled;
                // Save to file
                app.library_manager.save_library()?;
                Ok(())
            } else {
                Err(ZdbError::invalid_parameter("词典配置不存在".to_string()))
            }
        } else {
            Err(ZdbError::invalid_parameter("词典组不存在".to_string()))
        }
    }).into_string_result()
}

/// Adjust profile order within a group
#[command]
pub async fn library_adjust_profile_order(
    parent_group_id: ProfileId, 
    profile_id: ProfileId, 
    new_index: usize
) -> std::result::Result<(), String> {
    with_write_access(|app| {
        app.library_manager.adjust_profile_order(parent_group_id, profile_id, new_index);
        // Save to file
        app.library_manager.save_library()?;
        Ok(())
    }).into_string_result()
}

/// Adjust group order
#[command]
pub async fn library_adjust_group_order(group_id: ProfileId, new_index: usize) -> std::result::Result<(), String> {
    with_write_access(|app| {
        app.library_manager.adjust_group_order(group_id, new_index);
        // Save to file
        app.library_manager.save_library()?;
        Ok(())
    }).into_string_result()
}

/// Open main database with the given profile
#[command]
pub async fn library_open_main_database(profile_id: ProfileId) -> std::result::Result<(), String> {
    with_write_access(|app| app.open_main_db(profile_id)).into_string_result()
}

/// Get current main profile ID
#[command]
pub async fn library_get_current_main_profile_id() -> std::result::Result<ProfileId, String> {
    with_read_access(|app| app.get_current_main_profile_id()).into_string_result()
}

/// Get main database profile (complete object)
#[command]
pub async fn library_get_main_db_profile() -> std::result::Result<Option<serde_json::Value>, String> {
    with_read_access(|app| {
        match app.get_current_main_profile()? {
            Some(profile) => {
                let profile_json = serde_json::to_value(profile)
                    .map_err(|e| ZdbError::invalid_data_format(format!("Failed to serialize profile: {}", e)))?;
                Ok(Some(profile_json))
            },
            None => Ok(None)
        }
    }).into_string_result()
}

/// Rebuild dictionary index with collation options
#[command]
pub async fn library_rebuild_index(
    profile_id: ProfileId,
    options: CollationOptions
) -> std::result::Result<(), String> {
    with_write_access(|_app| {
        log::info!("Rebuilding index for profile {} with options: {:?}", profile_id, options);
        
        // Build BCP 47 locale string with collation extensions
        let mut locale_str = options.language.clone();
        
        // Add Unicode extension for collation
        let mut extensions = vec![];
        
        // Collation type (e.g., pinyin, stroke, traditional)
        if let Some(ref collation_type) = options.collation_type {
            if collation_type != "standard" {
                extensions.push(format!("co-{}", collation_type));
            }
        }
        
        // Strength level (ks = collation strength)
        let strength = match options.strength.as_str() {
            "level1" => "level1",
            "level2" => "level2",
            "level3" => "level3",
            "level4" => "level4",
            _ => "level1",
        };
        extensions.push(format!("ks-{}", strength));
        
        // Alternate handling (ka = alternate handling)
        if options.alternate_handling == "shifted" {
            extensions.push("ka-shifted".to_string());
        }
        
        // Case level (kc = case level)
        if options.case_level == "true" {
            extensions.push("kc-true".to_string());
        }
        
        // Case first (kf = case first)
        if options.case_first != "off" {
            extensions.push(format!("kf-{}", options.case_first));
        }
        
        if !extensions.is_empty() {
            locale_str.push_str("-u-");
            locale_str.push_str(&extensions.join("-"));
        }
        
        log::info!("Generated BCP 47 locale string: {}", locale_str);        
        Ok(())
    }).into_string_result()
}

