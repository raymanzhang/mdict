// Config commands module - Tauri command implementations for configuration management
use serde_json::Value;
use tauri::command;

use crate::app_config::{AppConfig, ConfigSection, ConfigKey};
use crate::error::IntoStringResult;
use crate::mdict_app::{with_config_read, with_config_write};

/// Get app configuration
#[command]
pub async fn config_get_app_config() -> std::result::Result<AppConfig, String> {
    with_config_read(|config| Ok(config.clone())).into_string_result()
}

// ============ Generic Config Commands ============

/// Generic get config value
/// 
/// # Arguments
/// * `section` - "global" or "view"
/// * `key` - config key string
#[command]
pub async fn config_get_value(section: String, key: String) -> std::result::Result<Value, String> {
    with_config_read(|config| {
        let config_section = match section.as_str() {
            "global" => ConfigSection::Global,
            "view" => ConfigSection::View,
            _ => return Err(crate::error::ZdbError::invalid_parameter(format!("Invalid section: {}", section))),
        };
        
        let config_key = ConfigKey::from_str(&key)
            .ok_or_else(|| crate::error::ZdbError::invalid_parameter(format!("Invalid config key: {}", key)))?;
        
        config.get_config::<Value>(config_section, config_key)
    }).into_string_result()
}

/// Generic set config value
/// 
/// # Arguments
/// * `section` - "global" or "view"
/// * `key` - config key string
/// * `value` - JSON value to set
#[command]
pub async fn config_set_value(section: String, key: String, value: Value) -> std::result::Result<(), String> {
    with_config_write(|config| {
        let config_section = match section.as_str() {
            "global" => ConfigSection::Global,
            "view" => ConfigSection::View,
            _ => return Err(crate::error::ZdbError::invalid_parameter(format!("Invalid section: {}", section))),
        };
        
        let config_key = ConfigKey::from_str(&key)
            .ok_or_else(|| crate::error::ZdbError::invalid_parameter(format!("Invalid config key: {}", key)))?;
        
        config.set_config(config_section, config_key, value)?;
        config.save()
    }).into_string_result()
}

/// Get all global settings
#[command]
pub async fn config_get_global_settings() -> std::result::Result<Value, String> {
    with_config_read(|config| Ok(config.global_settings.clone())).into_string_result()
}

/// Get all view settings
#[command]
pub async fn config_get_view_settings() -> std::result::Result<Value, String> {
    with_config_read(|config| Ok(config.view_settings.clone())).into_string_result()
}

/// Update multiple view settings at once
#[command]
pub async fn config_update_view_settings(settings: Value) -> std::result::Result<(), String> {
    with_config_write(|config| {
        config.view_settings = settings;
        config.save()
    }).into_string_result()
}

// ============ Utility Commands ============

/// List font files in a directory
#[command]
pub async fn config_list_fonts_in_directory(path: String) -> std::result::Result<Vec<String>, String> {
    use std::fs;
    
    let mut fonts = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                let lower = file_name.to_lowercase();
                if lower.ends_with(".ttf") || lower.ends_with(".otf") || lower.ends_with(".ttc") {
                    // Remove extension and add to list
                    if let Some(name) = file_name.rsplitn(2, '.').nth(1) {
                        fonts.push(name.to_string());
                    }
                }
            }
        }
    }
    
    fonts.sort();
    Ok(fonts)
}

/// Save app configuration to disk
#[command]
pub async fn config_save_app_config() -> std::result::Result<(), String> {
    with_config_read(|config| config.save()).into_string_result()
}

/// Reload app configuration from disk
#[command]
pub async fn config_reload_app_config() -> std::result::Result<(), String> {
    with_config_write(|config| config.reload()).into_string_result()
}

/// Reload resources
#[command]
pub async fn config_reload_resources() -> std::result::Result<(), String> {
    crate::mdict_app::with_write_access(|app| app.reload_resources()).into_string_result()
}


