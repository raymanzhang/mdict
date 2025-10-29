/**
 * Search API Module
 * 
 * Handles all search and content retrieval operations.
 * Extracted from AppContext for better modularity.
 * 
 * Following best practices:
 * - Single responsibility (search operations only)
 * - Clean API boundary
 * - Reusable across components
 */

import { invoke } from '@tauri-apps/api/core';
import { MdxGroupIndex, SearchResultEntry, MdxIndex } from '../types';
import { useSystemStore } from '../store/useSystemStore';

/**
 * Perform incremental (index) search
 * Returns {start_entry_no: -1, total_count: 0} if no results found
 */
export const searchIncremental = async (
  query: string
): Promise<{ start_entry_no: number; total_count: number }> => {
  return await invoke('search_search_incremental', { query });
};

/**
 * Perform fulltext search
 */
export const fulltextSearch = async (
  query: string
): Promise<{ start_entry_no: number; total_count: number }> => {
  return await invoke('search_fulltext_search', { query });
};

/**
 * Get content URL for an entry by index number
 */
export const getContentUrl = async (indexNo: number): Promise<string> => {
  return await invoke('search_get_content_url', { indexNo });
};

/**
 * Get total entry count
 */
export const getEntryCount = async (): Promise<number> => {
  return await invoke('search_get_entry_count');
};

/**
 * Find index by keyword
 */
export const findIndex = async (
  key: string
): Promise<{ group_index: MdxGroupIndex; total_count: number }> => {
  return await invoke('search_find_index', { key });
};

/**
 * Get result key list (paginated search results)
 */
export const getResultKeyList = async (
  startIndexNo: number,
  maxCount: number
): Promise<SearchResultEntry[]> => {
  const results = await invoke<[string, number][]>('search_get_result_key_list', {
    startIndexNo,
    maxCount,
  });
  // Transform tuple array to SearchResultEntry objects
  return results.map(([keyword, entry_count]) => ({
    keyword,
    entry_count,
  }));
};

/**
 * Get group indexes for a given index number
 */
export const getGroupIndexes = async (indexNo: number): Promise<MdxGroupIndex[]> => {
  return await invoke('search_get_group_indexes', { indexNo });
};

/**
 * Generate URL for an MdxIndex
 */
export const getUrlForIndex = async (mdxIndex: MdxIndex): Promise<string> => {
  const url= `${useSystemStore.getState().baseUrl}entryx?profile_id=${mdxIndex.profile_id}&entry_no=${mdxIndex.entry_no}`;
  console.log('Generated URL:', url);
  return url;
};


