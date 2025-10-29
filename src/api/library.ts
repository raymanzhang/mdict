/**
 * Library API Module
 * 
 * Handles all library and group management operations.
 * Extracted from AppContext for better modularity.
 * 
 * Following best practices:
 * - Single responsibility (library operations only)
 * - Clean API boundary
 * - Reusable across components
 */

import { invoke } from '@tauri-apps/api/core';
import { MdxProfile } from '../types';

/**
 * Create a new dictionary group
 */
export const createDictGroup = async (groupName: string): Promise<number> => {
  return await invoke('library_create_dict_group', { groupName });
};

/**
 * Delete a dictionary group
 */
export const deleteDictGroup = async (groupId: number): Promise<void> => {
  await invoke('library_delete_dict_group', { groupId });
};

/**
 * Rename a dictionary group
 */
export const renameDictGroup = async (groupId: number, newName: string): Promise<void> => {
  await invoke('library_rename_dict_group', { groupId, newName });
};

/**
 * Refresh library from disk
 */
export const refreshLibrary = async (): Promise<void> => {
  await invoke('library_refresh_library');
};

/**
 * Get group for a given group_id
 */
export const getGroup = async (groupId: number): Promise<MdxProfile> => {
  return await invoke('library_get_group', { groupId });
};

/**
 * Get profile for a given group_id and profile_id
 */
export const getProfile = async (groupId: number, profileId: number): Promise<MdxProfile> => {
  return await invoke('library_get_profile', { groupId, profileId });
};

/**
 * List all groups
 */
export const listGroups = async (): Promise<MdxProfile[]> => {
  return await invoke('library_list_groups');
};

/**
 * Update profile disabled status in a group
 */
export const updateProfileDisabledStatus = async (
  parentGroupId: number,
  profileId: number,
  disabled: boolean
): Promise<void> => {
  await invoke('library_update_profile_disabled_status', {
    parentGroupId,
    profileId,
    disabled,
  });
};

/**
 * Adjust profile order within a group
 */
export const adjustProfileOrder = async (
  parentGroupId: number,
  profileId: number,
  newIndex: number
): Promise<void> => {
  await invoke('library_adjust_profile_order', {
    parentGroupId,
    profileId,
    newIndex,
  });
};

/**
 * Adjust group order
 */
export const adjustGroupOrder = async (groupId: number, newIndex: number): Promise<void> => {
  await invoke('library_adjust_group_order', { groupId, newIndex });
};

/**
 * Open main database with the given profile
 */
export const openMainDatabase = async (profileId: number): Promise<void> => {
  await invoke('library_open_main_database', { profileId });
};

/**
 * Get current main profile ID
 */
export const getCurrentMainProfileId = async (): Promise<number> => {
  return await invoke('library_get_current_main_profile_id');
};

/**
 * Get main database profile
 */
export const getMainDbProfile = async (): Promise<MdxProfile | null> => {
  return await invoke('library_get_main_db_profile');
};

// Export types from ConvertDBDialog
export type { CollationOptions, ConvertOptions } from '../components/ConvertDBDialog';

/**
 * Result of database conversion
 */
export interface ConversionResult {
  newMdxPath: string;
  newMddPath?: string;
}

/**
 * Convert MDX/MDD files to new format
 */
export const convertFile = async (
  profileId: number,
  collationLocale: string,
  removeOldFiles: boolean = true
): Promise<ConversionResult> => {
  return await invoke('library_convert_db', { profileId, collationLocale, removeOldFiles });
};

/**
 * Create fulltext search index
 */
export const createFtsIndex = async (mdxFilePath: string): Promise<void> => {
  await invoke('library_create_fts_index', { mdxFilePath });
};

/**
 * Cancel ongoing conversion
 */
export const cancelConversion = async (): Promise<void> => {
  await invoke('library_cancel_conversion');
};

