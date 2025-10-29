/**
 * Configuration API Module
 * 
 * Provides generic configuration access following app_config.rs pattern.
 * 
 * Following best practices:
 * - Generic get/set interface
 * - Type-safe config keys
 * - Clean API boundary
 * - Minimal command surface
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * Configuration section type
 */
export type ConfigSection = 'global' | 'view';

/**
 * Configuration key type - matches ConfigKey enum in Rust
 */
export type ConfigKey = 
  // Global settings
  | 'app_owner'
  | 'audio_lib_path'
  | 'extra_lib_search_path'
  | 'custom_font_path'
  | 'auto_lookup_clipboard'
  | 'monitor_clipboard'
  | 'auto_lookup_selection'
  | 'hotkey_letter'
  | 'hotkey_modifier'
  | 'use_popover_for_lookup'
  | 'last_main_profile_id'
  // View settings
  | 'gui_language'
  | 'appearance_mode'
  | 'font_face'
  | 'font_color'
  | 'background_color'
  | 'auto_resize_image';

// ============ Generic Config API ============

/**
 * Get app configuration (full config object)
 */
export const getAppConfig = async (): Promise<any> => {
  return await invoke('config_get_app_config');
};

/**
 * Get a specific config value
 */
export const getConfigValue = async <T = any>(
  section: ConfigSection,
  key: ConfigKey
): Promise<T> => {
  return await invoke('config_get_value', { section, key });
};

/**
 * Set a specific config value
 */
export const setConfigValue = async <T = any>(
  section: ConfigSection,
  key: ConfigKey,
  value: T
): Promise<void> => {
  await invoke('config_set_value', { section, key, value });
};

/**
 * Get all global settings
 */
export const getGlobalSettings = async (): Promise<any> => {
  return await invoke('config_get_global_settings');
};

/**
 * Get all view settings
 */
export const getViewSettings = async (): Promise<any> => {
  return await invoke('config_get_view_settings');
};

/**
 * Update multiple view settings at once
 */
export const updateViewSettings = async (settings: any): Promise<void> => {
  await invoke('config_update_view_settings', { settings });
};

/**
 * Save app configuration to disk
 */
export const saveAppConfig = async (): Promise<void> => {
  await invoke('config_save_app_config');
};

/**
 * Reload app configuration from disk
 */
export const reloadAppConfig = async (): Promise<void> => {
  await invoke('config_reload_app_config');
};

/**
 * Reload resources
 */
export const reloadResources = async (): Promise<void> => {
  await invoke('config_reload_resources');
};

/**
 * Open directory picker dialog
 */
export const selectDirectory = async (title?: string, defaultPath?: string): Promise<string | null> => {
  const result = await open({
    directory: true,
    multiple: false,
    title: title || '选择目录',
    defaultPath: defaultPath,
  });
  
  return result as string | null;
};

/**
 * List font files in a directory
 */
export const listFontsInDirectory = async (path: string): Promise<string[]> => {
  return await invoke('config_list_fonts_in_directory', { path });
};

