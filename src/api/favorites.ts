/**
 * Favorites API Module
 * 
 * Handles all favorites-related operations with backend.
 * Uses the favorites plugin for SQLite-based persistence.
 * 
 * Following best practices:
 * - Single responsibility (favorites operations only)
 * - Clean API boundary
 * - Reusable across components
 */

import { invoke } from '@tauri-apps/api/core';
import { FavoriteEntry, FavoriteSortBy, MdxGroupIndex } from '../types';

/**
 * Add a favorite entry
 */
export const addFavorite = async (
  keyword: string,
  groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
  profileId: number,
  profileName: string
): Promise<FavoriteEntry> => {
  return await invoke('favorites_add_favorite', {
    keyword,
    groupIndex,
    profileId,
    profileName,
  });
};

/**
 * Remove a favorite entry by ID
 */
export const removeFavorite = async (id: string): Promise<boolean> => {
  return await invoke('favorites_remove_favorite', { id });
};

/**
 * Toggle favorite (add if not exists, remove if exists)
 * Returns true if added, false if removed
 */
export const toggleFavorite = async (
  keyword: string,
  groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
  profileId: number,
  profileName: string
): Promise<boolean> => {
  return await invoke('favorites_toggle_favorite', {
    keyword,
    groupIndex,
    profileId,
    profileName,
  });
};

/**
 * Check if favorited
 */
export const isFavorited = async (keyword: string, profileId: number): Promise<boolean> => {
  return await invoke('favorites_is_favorited', { keyword, profileId });
};

/**
 * Get sorted and filtered favorites
 */
export const getSortedAndFilteredFavorites = async (
  sortBy: FavoriteSortBy,
  filterProfileId: number | null
): Promise<FavoriteEntry[]> => {
  return await invoke('favorites_get_sorted_and_filtered_favorites', {
    sortBy,
    filterProfileId,
  });
};

/**
 * Get all favorites
 */
export const getAllFavorites = async (): Promise<FavoriteEntry[]> => {
  return await invoke('favorites_get_all_favorites');
};

/**
 * Clear all favorites
 */
export const clearAllFavorites = async (): Promise<void> => {
  await invoke('favorites_clear_all_favorites');
};

/**
 * Import favorites (for backup/restore)
 */
export const importFavorites = async (entries: FavoriteEntry[]): Promise<void> => {
  await invoke('favorites_import_favorites', { entries });
};

/**
 * Get favorites count
 */
export const getFavoritesCount = async (): Promise<number> => {
  return await invoke('favorites_get_favorites_count');
};

