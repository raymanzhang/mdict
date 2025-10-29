// Hotkey manager module
// This module is only available on desktop platforms (Windows, macOS, Linux)
// Mobile platforms (iOS, Android) do not support global hotkeys
#![cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]

use std::sync::Mutex;
use global_hotkey::{GlobalHotKeyManager, GlobalHotKeyEvent, hotkey::{HotKey, Modifiers, Code}};
use log::{error, info};
use once_cell::sync::Lazy;
use tauri::{AppHandle, Manager, Emitter};

/// Wrapper around GlobalHotKeyManager to make it Send + Sync
/// This is safe because:
/// 1. The manager is always protected by a Mutex
/// 2. The raw pointer inside GlobalHotKeyManager is managed by the OS
/// 3. The global-hotkey library handles internal synchronization
struct SendableHotKeyManager(GlobalHotKeyManager);

// SAFETY: GlobalHotKeyManager is only accessed through Mutex protection,
// and the underlying OS resources are thread-safe
unsafe impl Send for SendableHotKeyManager {}
unsafe impl Sync for SendableHotKeyManager {}

impl SendableHotKeyManager {
    fn new() -> Result<Self, global_hotkey::Error> {
        GlobalHotKeyManager::new().map(SendableHotKeyManager)
    }
    
    fn register(&self, hotkey: HotKey) -> Result<(), global_hotkey::Error> {
        self.0.register(hotkey)
    }
    
    fn unregister(&self, hotkey: HotKey) -> Result<(), global_hotkey::Error> {
        self.0.unregister(hotkey)
    }
}

/// Global hotkey manager state
static HOTKEY_MANAGER: Lazy<Mutex<Option<SendableHotKeyManager>>> = Lazy::new(|| Mutex::new(None));
static REGISTERED_HOTKEY: Lazy<Mutex<Option<HotKey>>> = Lazy::new(|| Mutex::new(None));
static APP_HANDLE: Lazy<Mutex<Option<AppHandle>>> = Lazy::new(|| Mutex::new(None));

/// Parse modifier string to Modifiers
fn parse_modifier(modifier: &str) -> Option<Modifiers> {
    let modifier = modifier.to_lowercase();
    let parts = modifier.split('+').collect::<Vec<&str>>();
    if parts.is_empty() {
        return None;
    }
    
    let mut result = Modifiers::empty();
    for part in parts {
        match part.trim() {
            "ctrl" | "control" => result |= Modifiers::CONTROL,
            "shift" => result |= Modifiers::SHIFT,
            "alt" | "option" => result |= Modifiers::ALT,
            "super" | "cmd" | "command" | "meta" => result |= Modifiers::SUPER,
            _ => return None,
        }
    }
    
    Some(result)
}

/// Parse key letter to Code
fn parse_key_code(letter: &str) -> Option<Code> {
    if letter.len() == 1 {
        let ch = letter.chars().next().unwrap().to_ascii_uppercase();
        match ch {
            'A'..='Z' => {
                let offset = (ch as u32 - 'A' as u32) as usize;
                let codes = [
                    Code::KeyA, Code::KeyB, Code::KeyC, Code::KeyD, Code::KeyE,
                    Code::KeyF, Code::KeyG, Code::KeyH, Code::KeyI, Code::KeyJ,
                    Code::KeyK, Code::KeyL, Code::KeyM, Code::KeyN, Code::KeyO,
                    Code::KeyP, Code::KeyQ, Code::KeyR, Code::KeyS, Code::KeyT,
                    Code::KeyU, Code::KeyV, Code::KeyW, Code::KeyX, Code::KeyY,
                    Code::KeyZ,
                ];
                codes.get(offset).copied()
            }
            '0'..='9' => {
                let offset = (ch as u32 - '0' as u32) as usize;
                let codes = [
                    Code::Digit0, Code::Digit1, Code::Digit2, Code::Digit3, Code::Digit4,
                    Code::Digit5, Code::Digit6, Code::Digit7, Code::Digit8, Code::Digit9,
                ];
                codes.get(offset).copied()
            }
            _ => None,
        }
    } else {
        None
    }
}

/// Initialize the hotkey manager
pub fn init_hotkey_manager(app_handle: AppHandle) -> Result<(), String> {
    let mut manager = HOTKEY_MANAGER.lock().unwrap();
    if manager.is_none() {
        *manager = Some(SendableHotKeyManager::new().map_err(|e| format!("Failed to create GlobalHotKeyManager: {}", e))?);
        info!("GlobalHotKeyManager initialized");
    }
    
    // Store app handle
    let mut handle = APP_HANDLE.lock().unwrap();
    *handle = Some(app_handle);
    
    Ok(())
}

/// Register a global hotkey
pub fn register_hotkey(app_handle: AppHandle, letter: &str, modifier: &str) -> Result<(), String> {
    // Initialize if not already done
    init_hotkey_manager(app_handle)?;
    
    // Unregister existing hotkey if any
    unregister_hotkey()?;

    // Check if both letter and modifier are empty
    if letter.is_empty() || modifier.is_empty() {
        info!("Hotkey is empty, skipping registration");
        return Ok(());
    }

    // Parse modifier and key code
    let modifiers = parse_modifier(modifier)
        .ok_or_else(|| format!("Invalid modifier: {}", modifier))?;
    let code = parse_key_code(letter)
        .ok_or_else(|| format!("Invalid key letter: {}", letter))?;

    info!("Registering hotkey: {} + {:?}", modifier, letter);

    // Create hotkey
    let hotkey = HotKey::new(Some(modifiers), code);
    
    // Register the hotkey
    let manager = HOTKEY_MANAGER.lock().unwrap();
    if let Some(mgr) = manager.as_ref() {
        mgr.register(hotkey).map_err(|e| format!("Failed to register hotkey: {}", e))?;
        info!("Hotkey registered successfully");
        
        // Store the registered hotkey
        let mut registered = REGISTERED_HOTKEY.lock().unwrap();
        *registered = Some(hotkey);
        
        Ok(())
    } else {
        Err("GlobalHotKeyManager not initialized".to_string())
    }
}

/// Unregister the current global hotkey
pub fn unregister_hotkey() -> Result<(), String> {
    let mut registered = REGISTERED_HOTKEY.lock().unwrap();
    
    if let Some(hotkey) = registered.take() {
        info!("Unregistering hotkey");
        let manager = HOTKEY_MANAGER.lock().unwrap();
        if let Some(mgr) = manager.as_ref() {
            mgr.unregister(hotkey).map_err(|e| format!("Failed to unregister hotkey: {}", e))?;
            info!("Hotkey unregistered successfully");
            Ok(())
        } else {
            Err("GlobalHotKeyManager not initialized".to_string())
        }
    } else {
        // No hotkey registered, nothing to do
        Ok(())
    }
}

/// Check for hotkey events and handle them
/// This should be called from a loop or event handler
pub fn check_hotkey_events() {
    if let Ok(event) = GlobalHotKeyEvent::receiver().try_recv() {
        info!("Hotkey event received: {:?}", event);
        
        // Get the app handle
        let app_handle_lock = APP_HANDLE.lock().unwrap();
        if let Some(app_handle) = app_handle_lock.as_ref() {
            info!("Hotkey pressed, bringing window to front");
            
            // Get the main window and bring it to front
            if let Some(window) = app_handle.get_webview_window("main") {
                if let Err(e) = window.set_focus() {
                    error!("Failed to focus window: {}", e);
                }
                if let Err(e) = window.show() {
                    error!("Failed to show window: {}", e);
                }
                if let Err(e) = window.unminimize() {
                    error!("Failed to unminimize window: {}", e);
                }
                
                // Emit window-focus event to frontend
                if let Err(e) = app_handle.emit("window-focus", ()) {
                    error!("Failed to emit window-focus event: {}", e);
                }
            } else {
                error!("Failed to get main window");
            }
        }
    }
}

