/**
 * History API Module
 * 
 * Handles all history-related operations with backend.
 * Uses the history plugin for SQLite-based persistence.
 * 
 * Following best practices:
 * - Single responsibility (history operations only)
 * - Clean API boundary
 * - Reusable across components
 */

import { invoke } from '@tauri-apps/api/core';
import { HistoryEntry, MdxGroupIndex } from '../types';

/**
 * Add a history entry
 */
export const addToHistory = async (
  keyword: string,
  groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
  profileId: number,
  profileName: string
): Promise<HistoryEntry> => {
  return await invoke('history_add_to_history', {
    keyword,
    groupIndex,
    profileId,
    profileName,
  });
};

/**
 * Get all history entries
 */
export const getAllHistory = async (): Promise<HistoryEntry[]> => {
  return await invoke('history_get_all_history');
};

/**
 * Get history entry by ID
 */
export const getHistoryEntryById = async (id: string): Promise<HistoryEntry | null> => {
  return await invoke('history_get_history_entry_by_id', { id });
};

/**
 * Remove a history entry by ID
 */
export const removeFromHistory = async (id: string): Promise<boolean> => {
  return await invoke('history_remove_from_history', { id });
};

/**
 * Clear all history
 */
export const clearHistory = async (): Promise<void> => {
  await invoke('history_clear_history');
};

/**
 * Get history count
 */
export const getHistoryCount = async (): Promise<number> => {
  return await invoke('history_get_history_count');
};

/**
 * Set maximum history size
 */
export const setMaxHistorySize = async (size: number): Promise<void> => {
  await invoke('history_set_max_history_size', { size });
};

/**
 * Get maximum history size
 */
export const getMaxHistorySize = async (): Promise<number> => {
  return await invoke('history_get_max_history_size');
};

/**
 * Import history entries (for backup/restore)
 */
export const importHistory = async (entries: HistoryEntry[]): Promise<void> => {
  await invoke('history_import_history', { entries });
};

