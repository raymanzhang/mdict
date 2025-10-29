/**
 * System API Module
 * 
 * Handles system-level operations like base URL management.
 * 
 * Following best practices:
 * - Single responsibility (system operations only)
 * - Clean API boundary
 * - Reusable across components
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Set base URL
 */
export const setBaseUrl = async (baseUrl: string): Promise<void> => {
  await invoke('system_set_base_url', { baseUrl });
};

