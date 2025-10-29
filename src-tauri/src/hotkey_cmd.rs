// Hotkey commands module
// This module is only available on desktop platforms (Windows, macOS, Linux)
// Mobile platforms (iOS, Android) do not support global hotkeys
#![cfg(all(not(target_os = "android"), not(target_os = "ios"), feature = "global-hotkey"))]

use log::info;
use tauri::{AppHandle, command};

/// Register a global hotkey
#[command]
pub fn hotkey_register(app_handle: AppHandle, letter: String, modifier: String) -> Result<(), String> {
    info!("Command: hotkey_register - letter: {}, modifier: {}", letter, modifier);
    crate::hotkey_manager::register_hotkey(app_handle, &letter, &modifier)
}

/// Unregister the current global hotkey
#[command]
pub fn hotkey_unregister() -> Result<(), String> {
    info!("Command: hotkey_unregister");
    crate::hotkey_manager::unregister_hotkey()
}

