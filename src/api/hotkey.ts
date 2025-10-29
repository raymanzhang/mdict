/**
 * Hotkey API
 * 
 * Provides functions to register and unregister global hotkeys via Tauri commands.
 * Note: Hotkeys are only available on desktop platforms (Windows, macOS, Linux).
 * On mobile platforms (iOS, Android), these functions will reject with an error.
 */

import { invoke } from '@tauri-apps/api/core';
import { isHotkeyAvailable } from '../utils/platformUtils';

/**
 * Register a global hotkey
 * @param letter - The key letter (e.g., 'A', 'B', etc.)
 * @param modifier - The modifier key (e.g., 'Ctrl', 'Shift', 'Alt', 'Super', or combinations like 'Ctrl+Shift')
 * @throws Error if hotkeys are not available on the current platform
 */
export async function registerHotkey(letter: string, modifier: string): Promise<void> {
  if (!isHotkeyAvailable()) {
    throw new Error('Hotkeys are not available on mobile platforms');
  }
  await invoke('hotkey_register', { letter, modifier });
}

/**
 * Unregister the current global hotkey
 * @throws Error if hotkeys are not available on the current platform
 */
export async function unregisterHotkey(): Promise<void> {
  if (!isHotkeyAvailable()) {
    throw new Error('Hotkeys are not available on mobile platforms');
  }
  await invoke('hotkey_unregister');
}

