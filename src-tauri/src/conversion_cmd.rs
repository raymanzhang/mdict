// Conversion commands module - Tauri command implementations for MDX/MDD conversion and indexing
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use log::*;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter};
use url::Url;

use mdx::builder::{ZDBBuilder, BuilderConfig, SourceType, make_index};
use mdx::utils::ProgressState;

use crate::error::{ZdbError, IntoStringResult};
use crate::error_printer::format_error;
use crate::mdict_app::with_read_access;
use crate::mdx_profile::ProfileId;

/// Progress information for conversion/indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionProgress {
    pub stage: String,  // "mdx", "mdd", or "idx"
    pub sub_stage: String,  // Sub-stage name from ProgressState.state_id
    pub current: u64,
    pub total: u64,
    pub message: Option<String>,
}

/// Global state for progress reporting and cancellation
struct GlobalConversionState {
    app_handle: Option<AppHandle>,
    current_stage: String,
    cancelled: AtomicBool,
}

impl GlobalConversionState {
    fn new() -> Self {
        Self {
            app_handle: None,
            current_stage: String::new(),
            cancelled: AtomicBool::new(false),
        }
    }

    fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    fn set_stage(&mut self, stage: String) {
        self.current_stage = stage;
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    fn reset(&mut self) {
        self.cancelled.store(false, Ordering::Relaxed);
        self.current_stage.clear();
    }

    fn report_progress(&self, sub_stage: &str, current: u64, total: u64, message: Option<String>) {
        if let Some(ref handle) = self.app_handle {
            let progress = ConversionProgress {
                stage: self.current_stage.clone(),
                sub_stage: sub_stage.to_string(),
                current,
                total,
                message,
            };
            let _ = handle.emit("conversion-progress", &progress);
            info!("Progress [{}:{}]: {}/{}", self.current_stage, sub_stage, current, total);
        }
    }
}

static CONVERSION_STATE: Lazy<Arc<Mutex<GlobalConversionState>>> = 
    Lazy::new(|| Arc::new(Mutex::new(GlobalConversionState::new())));

/// Progress reporter function that uses global state
/// Returns true to cancel the operation, false to continue
fn progress_reporter(state: &mut ProgressState) -> bool {
    let global_state = CONVERSION_STATE.lock().unwrap();
    
    // Check if cancelled
    if global_state.is_cancelled() {
        state.error_msg = "Conversion cancelled by user".to_string();
        return true; // true means stop the operation
    }
    
    // Report progress with state_id as sub_stage
    global_state.report_progress(&state.state_id, state.current, state.total, None);
    
    false // false means continue
}


/// Result of database conversion
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionResult {
    pub new_mdx_path: String,
    pub new_mdd_path: Option<String>,
}

/// Convert MDX or MDD file to new format
#[command]
pub async fn library_convert_db(
    app_handle: AppHandle,
    profile_id: ProfileId,
    collation_locale: String,
    remove_old_files: bool,
) -> std::result::Result<ConversionResult, String> {
    info!("Starting file conversion for profile: {}", profile_id);
    
    // Initialize global state
    {
        let mut state = CONVERSION_STATE.lock().unwrap();
        state.reset();
        state.set_app_handle(app_handle.clone());
    }
    
    // Get profile information
    let profile = with_read_access(|app| {
        app.library_manager.find_profile(profile_id)
            .ok_or_else(|| ZdbError::invalid_parameter(format!("Profile {} not found", profile_id)))
            .map(|p| p.clone())
    }).into_string_result()?;
    
    if profile.is_group() {
        return Err("Cannot convert a group".to_string());
    }
    
    // Parse URL to get file path
    let url = Url::parse(&profile.url)
        .map_err(|e| format!("Invalid profile URL: {}", e))?;
    
    let mdx_path = url.to_file_path()
        .map_err(|_| format!("Cannot convert URL to file path: {}", profile.url))?;
    
    if !mdx_path.exists() {
        return Err(format!("MDX file not found: {:?}", mdx_path));
    }
    
    // Generate output paths
    let mut new_mdx_path = mdx_path.clone();
    let new_filename = format!(
        "{}.new.mdx",
        mdx_path.file_stem().and_then(|s| s.to_str()).unwrap_or("dict")
    );
    new_mdx_path.set_file_name(new_filename);
    
    // Check for MDD file
    let mdd_path = mdx_path.with_extension("mdd");
    let has_mdd = mdd_path.exists();
    let mut new_mdd_path = mdd_path.clone();
    if has_mdd {
        let mdd_filename = format!(
            "{}.new.mdd",
            mdd_path.file_stem().and_then(|s| s.to_str()).unwrap_or("dict")
        );
        new_mdd_path.set_file_name(mdd_filename);
    }
    
    // Spawn blocking task for conversion
    let collation_locale_clone = collation_locale.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        // Step 1: Convert MDX file
        {
            let mut state = CONVERSION_STATE.lock().unwrap();
            state.set_stage("mdx".to_string());
        }
        
        info!("Converting MDX file: {:?}", mdx_path);
        let mut config = BuilderConfig::default();
        config.input_path = mdx_path.to_string_lossy().to_string();
        config.output_file = new_mdx_path.to_string_lossy().to_string();
        config.data_source_format = SourceType::Zdb;
        config.default_sorting_locale = collation_locale_clone.clone();
        config.build_mdd = false;
        
        if let Err(e) = ZDBBuilder::build_with_config(&config, Some(progress_reporter)) {
            let _ = std::fs::remove_file(&new_mdx_path);
            return Err(format!("MDX conversion failed: {}", e));
        }
        
        // Report MDX stage completion
        {
            let state = CONVERSION_STATE.lock().unwrap();
            state.report_progress("completed", 100, 100, Some("MDX conversion completed".to_string()));
        }
        
        // Step 2: Convert MDD file if exists
        if has_mdd {
            // Check for cancellation
            {
                let state = CONVERSION_STATE.lock().unwrap();
                if state.is_cancelled() {
                    let _ = std::fs::remove_file(&new_mdx_path);
                    return Err("Conversion cancelled".to_string());
                }
                
                drop(state);
                let mut state = CONVERSION_STATE.lock().unwrap();
                state.set_stage("mdd".to_string());
            }
            
            info!("Converting MDD file: {:?}", mdd_path);
            let mut mdd_config = BuilderConfig::default();

            mdd_config.input_path = mdd_path.to_string_lossy().to_string();
            mdd_config.output_file = new_mdd_path.to_string_lossy().to_string();
            mdd_config.data_source_format = SourceType::Zdb;
            mdd_config.content_type = "Binary".to_string(); // MDD files typically contain resources
            mdd_config.default_sorting_locale = "".to_string();
            mdd_config.build_mdd = true;
            
            if let Err(e) = ZDBBuilder::build_with_config(&mdd_config, Some(progress_reporter)) {
                let _ = std::fs::remove_file(&new_mdx_path);
                let _ = std::fs::remove_file(&new_mdd_path);
                debug!("MDD conversion failed:\n{}", format_error(&e));
                return Err(format!("MDD conversion failed: {}", e));
            }
            
            // Report MDD stage completion
            {
                let state = CONVERSION_STATE.lock().unwrap();
                state.report_progress("completed", 100, 100, Some("MDD conversion completed".to_string()));
            }
        } else {
            // No MDD file, report MDD stage as skipped/completed
            {
                let mut state = CONVERSION_STATE.lock().unwrap();
                state.set_stage("mdd".to_string());
                state.report_progress("skipped", 100, 100, Some("No MDD file".to_string()));
            }
        }
        
        // Step 3: Replace old files with new ones or keep both
        let (final_mdx_path, final_mdd_path) = if remove_old_files {
            info!("Replacing old files with new ones");
            
            // Delete old MDX
            if let Err(e) = std::fs::remove_file(&mdx_path) {
                error!("Failed to delete old MDX file: {}", e);
                let _ = std::fs::remove_file(&new_mdx_path);
                if has_mdd {
                    let _ = std::fs::remove_file(&new_mdd_path);
                }
                return Err(format!("Failed to delete old MDX file: {}", e));
            }
            
            // Rename new MDX to original name
            if let Err(e) = std::fs::rename(&new_mdx_path, &mdx_path) {
                error!("Failed to rename new MDX file: {}", e);
                return Err(format!("Failed to rename new MDX file: {}", e));
            }
            
            // Handle MDD file
            let final_mdd = if has_mdd {
                if let Err(e) = std::fs::remove_file(&mdd_path) {
                    error!("Failed to delete old MDD file: {}", e);
                }
                
                if let Err(e) = std::fs::rename(&new_mdd_path, &mdd_path) {
                    error!("Failed to rename new MDD file: {}", e);
                }
                Some(mdd_path.to_string_lossy().to_string())
            } else {
                None
            };
            
            (mdx_path.to_string_lossy().to_string(), final_mdd)
        } else {
            info!("Keeping both old and new files (old files not removed)");
            // New files remain with .new.mdx and .new.mdd extensions
            let final_mdd = if has_mdd {
                Some(new_mdd_path.to_string_lossy().to_string())
            } else {
                None
            };
            (new_mdx_path.to_string_lossy().to_string(), final_mdd)
        };
        
        info!("File conversion completed successfully");
        Ok(ConversionResult {
            new_mdx_path: final_mdx_path,
            new_mdd_path: final_mdd_path,
        })
    }).await;
    
    match result {
        Ok(inner_result) => inner_result,
        Err(e) => Err(format!("Task execution failed: {}", e)),
    }
}

/// Generate fulltext index for MDX file
#[command]
pub async fn library_create_fts_index(
    app_handle: AppHandle,
    mdx_file_path: String,
) -> std::result::Result<(), String> {
    info!("Starting FTS index creation for: {}", mdx_file_path);
    
    // Initialize stage
    {
        let mut state = CONVERSION_STATE.lock().unwrap();
        state.set_app_handle(app_handle.clone());
        state.set_stage("idx".to_string());
    }
    
    // Get MDX file path from parameter
    let mdx_path = std::path::PathBuf::from(mdx_file_path);
    
    if !mdx_path.exists() {
        return Err(format!("MDX file not found: {:?}", mdx_path));
    }
    
    // Spawn blocking task for index creation
    let result = tauri::async_runtime::spawn_blocking(move || {
        // Check for cancellation
        {
            let state = CONVERSION_STATE.lock().unwrap();
            if state.is_cancelled() {
                return Err("Index creation cancelled".to_string());
            }
        }
        
        info!("Creating FTS index for: {:?}", mdx_path);
        
        if let Err(e) = make_index(&mdx_path, Some(progress_reporter)) {
            error!("Failed to create FTS index: {}", e);
            // Delete FTS index files if they exist
            let fts_dir = mdx_path.with_extension("mdx.idx");
            if fts_dir.exists() {
                let _ = std::fs::remove_dir_all(fts_dir);
            }
            return Err(format!("FTS index generation failed: {}", e));
        }
        
        // Report completion
        {
            let state = CONVERSION_STATE.lock().unwrap();
            state.report_progress("completed", 100, 100, Some("Index created successfully".to_string()));
        }
        
        info!("FTS index creation completed successfully");
        Ok(())
    }).await;
    
    match result {
        Ok(inner_result) => inner_result,
        Err(e) => Err(format!("Task execution failed: {}", e)),
    }
}

/// Cancel ongoing conversion/indexing
#[command]
pub async fn library_cancel_conversion() -> std::result::Result<(), String> {
    let state = CONVERSION_STATE.lock().unwrap();
    state.cancel();
    info!("Cancellation requested");
    Ok(())
}
