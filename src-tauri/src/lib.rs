// Error types module
pub mod error;
// Error printer module
pub mod error_printer;
// App configuration module
pub mod app_config;
// MDict app singleton module
pub mod mdict_app;
// Library manager module
pub mod library_mgr;
// Commands module - contains all Tauri command implementations (deprecated, use plugins instead)
// Commented out to avoid conflicts with plugin commands
// pub mod commands;
// History management module
pub mod history;
// History commands plugin
mod history_cmd;
// Favorites management module
pub mod favorites;
// Favorites commands plugin
mod favorites_cmd;
// Config commands plugin
mod config_cmd;
// Library commands plugin
mod library_cmd;
// Conversion commands plugin
mod conversion_cmd;
// Search commands plugin
mod search_cmd;
// System commands plugin
mod system_cmd;
mod mdx_profile;
mod mdx_db;
mod mdx_db_group;
mod request_handler;
mod mdx_url_parser;
mod action_handlers;
// Hotkey manager and commands are only available on desktop platforms
#[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
mod hotkey_manager;
#[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
mod hotkey_cmd;
mod utils;

use humantime::format_rfc3339;
use log::{LevelFilter, error, info, debug};
use tauri::Manager;
use tauri::http::{Response, StatusCode};

use crate::utils::log_if_err;

// Import all command functions
use crate::config_cmd::*;
use crate::conversion_cmd::*;
use crate::favorites_cmd::*;
use crate::history_cmd::*;
#[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
use crate::hotkey_cmd::*;
use crate::library_cmd::*;
use crate::search_cmd::*;
use crate::system_cmd::*;

/// Macro to generate the invoke handler with all commands
/// 
/// This macro centralizes all command registration by including all command functions
/// from all modules. When adding new commands, you need to:
/// 1. Add the command function to the appropriate module
/// 2. Add the command name to the module's COMMANDS array
/// 3. Add the function name to this macro
/// 
/// The macro ensures that all commands are registered consistently and makes it
/// easy to see all available commands in one place.
macro_rules! generate_all_commands_handler {
    () => {
        tauri::generate_handler![
            // Search commands
            search_search_incremental,
            search_get_content_url,
            search_get_entry_count,
            search_find_index,
            search_fulltext_search,
            search_get_result_key_list,
            search_get_group_indexes,
            // History commands
            history_add_to_history,
            history_get_all_history,
            history_get_history_entry_by_id,
            history_remove_from_history,
            history_clear_history,
            history_get_history_count,
            history_set_max_history_size,
            history_get_max_history_size,
            history_import_history,
            // Favorites commands
            favorites_add_favorite,
            favorites_remove_favorite,
            favorites_toggle_favorite,
            favorites_is_favorited,
            favorites_get_sorted_and_filtered_favorites,
            favorites_get_all_favorites,
            favorites_clear_all_favorites,
            favorites_import_favorites,
            favorites_get_favorites_count,
            // Config commands - Generic interface
            config_get_app_config,
            config_get_value,
            config_set_value,
            config_get_global_settings,
            config_get_view_settings,
            config_update_view_settings,
            config_list_fonts_in_directory,
            config_save_app_config,
            config_reload_app_config,
            config_reload_resources,
            // Library commands
            library_create_dict_group,
            library_delete_dict_group,
            library_rename_dict_group,
            library_refresh_library,
            library_get_group,
            library_get_profile,
            library_list_groups,
            library_update_profile_disabled_status,
            library_adjust_profile_order,
            library_adjust_group_order,
            library_open_main_database,
            library_get_current_main_profile_id,
            library_get_main_db_profile,
            library_rebuild_index,
            // Conversion commands
            library_convert_db,
            library_create_fts_index,
            library_cancel_conversion,
            // System commands
            system_set_base_url,
            // Hotkey commands (desktop only)
            #[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
            hotkey_register,
            #[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
            hotkey_unregister,
        ]
    };
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    unsafe { std::env::set_var("RUST_BACKTRACE", "1"); }

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
            
            // Setup logging
            fern::Dispatch::new()
            .format(|out, message, record| {
                out.finish(format_args!(
                    "[{} {} {}] {}",
                    format_rfc3339(std::time::SystemTime::now()),
                    record.level(),
                    record.target(),
                    message
                ))
            })
            .level(LevelFilter::Debug)  
            .chain(std::io::stdout())
            .apply().unwrap();
            
            // Initialize main app (includes history and favorites managers)
            log_if_err(&mdict_app::init_mdict_app(data_dir.clone(), Vec::new(), &app_handle));

            // Setup window event handler for focus detection
            let window = app.get_webview_window("main").expect("Failed to get main window");
            let app_handle_clone = app_handle.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(focused) = event {
                    if *focused {
                        info!("Window gained focus, notifying frontend");
                        // Emit event to frontend
                        // Frontend will check autoLookupSelection setting and handle clipboard accordingly
                        use tauri::Emitter;
                        if let Err(e) = app_handle_clone.emit("window-focus", ()) {
                            error!("Failed to emit window-focus event: {}", e);
                        }
                    }
                }
            });

            // Initialize hotkey manager (desktop only)
            #[cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]
            {
                if let Err(e) = hotkey_manager::init_hotkey_manager(app_handle.clone()) {
                    error!("Failed to initialize hotkey manager: {}", e);
                }

                // Load hotkey configuration from settings
                let app_handle_for_hotkey = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(config) = mdict_app::with_config_read(|config| Ok(config.clone())) {
                        let hotkey_letter = config.global_settings.get("hotkey_letter")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let hotkey_modifier = config.global_settings.get("hotkey_modifier")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        
                        if !hotkey_letter.is_empty() && !hotkey_modifier.is_empty() {
                            info!("Registering hotkey from config: {} + {}", hotkey_modifier, hotkey_letter);
                            if let Err(e) = hotkey_manager::register_hotkey(app_handle_for_hotkey, hotkey_letter, hotkey_modifier) {
                                error!("Failed to register hotkey on startup: {}", e);
                            }
                        } else {
                            info!("No hotkey configured");
                        }
                    }
                });

                // Spawn a task to check for hotkey events periodically
                let _hotkey_task = std::thread::spawn(move || {
                    loop {
                        hotkey_manager::check_hotkey_events();
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                });
            }
                        
            Ok(())
        })
        // Register protocol scheme based on platform
        // Windows: use "http" scheme
        // Non-Windows (macOS, Linux): use "mdx" scheme
        .register_asynchronous_uri_scheme_protocol(
            #[cfg(target_os = "windows")]
            "http",
            #[cfg(not(target_os = "windows"))]
            "mdx",
            |_app, request, responder| {
                tauri::async_runtime::spawn(async move {
                    let uri = request.uri().to_string();
                    
                    // Check if the request matches the configured base_url
                    // Only handle requests that start with base_url, otherwise let webview handle them
                    let base_url = mdict_app::with_read_access(|app| {
                        Ok(app.get_base_url().to_string())
                    }).unwrap_or("mdx://mdict.cn/service/".to_string());
                    
                    if !uri.starts_with(&base_url.replace("http.localhost", "localhost")) {
                        if uri.contains("/service/") {
                            debug!("Request does not match base_url, skipping: {}", uri);
                        }
                        return;
                    }

                    // Handle the request using our custom handler
                    match request_handler::handle_request(&request, &base_url) {
                        Ok(response) => responder.respond(response),
                        Err(err) => {
                            error!("Error in protocol handler: {}", err);
                            let error_html = format!("<html><body><h1>Protocol Error</h1><p>{}</p></body></html>", err);
                            let mut error_response = Response::new(error_html.into_bytes());
                            *error_response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                            error_response.headers_mut().insert("Content-Type", "text/html; charset=utf-8".parse().unwrap());
                            responder.respond(error_response);
                        }
                    }
                });
            }
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(generate_all_commands_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}