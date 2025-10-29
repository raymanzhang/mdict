/**
 * Search Store
 * 
 * Manages search state including:
 * - Current search query and mode
 * - Current displayed entries
 * - Search results with page-based LRU caching
 * - Pagination management
 * - Profile context for search
 * 
 * Following best practices:
 * - Immer for immutable updates
 * - DevTools for debugging
 * - LRU cache for efficient page-based data storage
 * - Direct data access without unnecessary abstractions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { LRUCache } from 'lru-cache';
import { MdxProfile, SearchMode, SearchResultEntry } from '../types';
import * as searchAPI from '../api/search';
import { libraryAPI } from '../api';
import { withAsyncHandler } from '../utils/storeUtils';

const PAGE_SIZE = 50;
const MAX_CACHED_PAGES = 20; // Cache up to 20 pages (1000 items)

// Private store variables (not exposed in state)
const pageCache = new LRUCache<number, SearchResultEntry[]>({
  max: MAX_CACHED_PAGES,
});
const loadingPages = new Set<number>();

/**
 * Helper functions for page loading
 */

/**
 * Get list of pages that need to be loaded (not already loaded or loading)
 */
function getPagesToLoad(firstPage: number, lastPage: number): number[] {
  const pagesToLoad: number[] = [];
  for (let page = firstPage; page <= lastPage; page++) {
    if (!loadingPages.has(page) && !pageCache.has(page)) {
      pagesToLoad.push(page);
    }
  }
  return pagesToLoad;
}

/**
 * Mark pages as currently loading
 */
function markPagesAsLoading(pages: number[]): void {
  pages.forEach(page => loadingPages.add(page));
}

/**
 * Load a single page of search results
 */
async function loadSinglePage(
  page: number,
  set: (fn: (draft: any) => void) => void
): Promise<void> {
  const pageStartIndex = page * PAGE_SIZE;
  try {
    const results = await searchAPI.getResultKeyList(pageStartIndex, PAGE_SIZE);
    
    pageCache.set(page, results);
    loadingPages.delete(page);
    
    // Increment cache version to trigger re-render
    set((draft) => {
      draft.entryCacheVersion += 1;
    });
  } catch (err) {
    console.error(`Failed to load page ${page}:`, err);
    loadingPages.delete(page);
    throw err; // Re-throw to let handleAsync handle the error
  }
}

/**
 * Load multiple pages in parallel
 */
async function loadPagesInParallel(
  pages: number[],
  set: (fn: (draft: any) => void) => void
): Promise<void> {
  await Promise.all(
    pages.map(page => {
      return loadSinglePage(page, set);
    })
  );
}

interface SearchState {
  // Current displayed entry
  currentProfile: MdxProfile | null;
    
  // Current search state
  searchTerm: string;
  searchMode: SearchMode;
  totalCount: number;
  currentIndex: number;  
  // Force re-render trigger - increment this to force component updates
  entryCacheVersion: number;
    
  // Loading and error state
  loading: boolean;
  error: string | null;
  
  useProfile: (profileId: number) => Promise<void>;

  // Search actions
  clearSearchState: () => void;
  performSearch: (query: string) => Promise<void>;
  
  // Data access
  loadPages: (startIndex: number, endIndex: number) => Promise<void>;
  loadEntries: (startIndex: number, endIndex: number) => Promise<SearchResultEntry[]>;
  getItem: (index: number) => SearchResultEntry | undefined;
  isItemLoaded: (index: number) => boolean;
  
  // State management
  setSearchMode: (mode: SearchMode) => void;
  setError: (error: string | null) => void;

  init: () => Promise<void>;
}

export const useSearchStore = create<SearchState>()(
  devtools(
    immer((set, get) => {
      // Create a bound version of withAsyncHandler for this store
      const handleAsync = <T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        errorMessage: string
      ) => withAsyncHandler(set, fn, errorMessage);

      return {
        // Initial state
        searchTerm: '',
        searchMode: 'index',
        currentProfile: null,
        totalCount: 0,
        currentIndex: -1,
        entryCacheVersion: 0,
        loading: false,
        error: null,

        init: async () => {
          pageCache.clear();
          loadingPages.clear();
          get().clearSearchState();
          set({ loading: true });
          try {
            const currentProfile = await libraryAPI.getMainDbProfile();
            set({
              currentProfile: currentProfile,
              entryCacheVersion: get().entryCacheVersion + 1,              
            });
          } catch (error) {
            console.error('Failed to initialize search:', error);
            set({ error: 'Failed to initialize search', loading: false });
          } finally {
            set({ loading: false });
          }
        },
        
        clearSearchState: () => {
          set({
            searchTerm: '',
            totalCount: 0,
            currentIndex: -1,
            error: null,
            loading: false,
          });
        },

        // Perform initial search
        performSearch: handleAsync(
          async (query: string) => {
            if (!query.trim()) {
              get().clearSearchState();
              return;
            }

            const mode = get().searchMode;
            const searchResult = mode === 'fulltext'
              ? await searchAPI.fulltextSearch(query)
              : await searchAPI.searchIncremental(query);
            
            // Handle no results found (start_entry_no === -1 indicates not found)
            if (searchResult.start_entry_no === -1) {
              // Clear old cache
              pageCache.clear();
              loadingPages.clear();
              set({ 
                entryCacheVersion: get().entryCacheVersion + 1,
                searchTerm: query,
                totalCount: 0,
                currentIndex: -1,
              });
              return;
            }
                       
            // Clear old cache
            pageCache.clear();
            loadingPages.clear();
            set({ entryCacheVersion: get().entryCacheVersion + 1 });

            // Load initial page
            await get().loadPages(searchResult.start_entry_no, searchResult.start_entry_no);
            set({
              searchTerm: query,
              totalCount: searchResult.total_count,
              currentIndex: searchResult.start_entry_no,
            });
          },
          'Failed to perform search'
        ),

        // Load pages in range
        // Note: This method is not wrapped with handleAsync because it's called
        // by other methods that are already wrapped (like performSearch).
        // Wrapping it would cause nested loading state conflicts.
        loadPages: async (startIndex: number, endIndex: number) => {
          // Calculate page range
          const firstPage = Math.floor(startIndex / PAGE_SIZE);
          const lastPage = Math.floor(endIndex / PAGE_SIZE);
          
          // Find pages that need to be loaded
          const pagesToLoad = getPagesToLoad(firstPage, lastPage);
          if (pagesToLoad.length === 0) {
            return;
          }
          
          // Mark pages as loading and load them in parallel
          markPagesAsLoading(pagesToLoad);
          await loadPagesInParallel(pagesToLoad, set);
        },

        // Get item by index
        getItem: (index: number) => {
          const page = Math.floor(index / PAGE_SIZE);
          const pageData = pageCache.get(page);
          if (!pageData) {
            return undefined;
          }
          const offsetInPage = index % PAGE_SIZE;
          return pageData[offsetInPage];
        },

        loadEntries: async (startIndex: number, endIndex: number) => {
          let entries: SearchResultEntry[] = [];
          await get().loadPages(startIndex, endIndex);
          for (let index = startIndex; index <= endIndex; index++) {
            const entry = get().getItem(index);
            if (entry) {
              entries[index] = entry;
            } else {
              throw new Error(`Item at index ${index} not found`);
            }
          }
          return entries;
        },

        // Check if item is loaded
        isItemLoaded: (index: number) => {
          const page = Math.floor(index / PAGE_SIZE);
          let hasItem = pageCache.has(page);
          return hasItem;
        },

        setSearchMode: (mode: SearchMode) => {
          set({ searchMode: mode });
        },
        
        setError: (error: string | null) => {
          set({ error });
        },

        useProfile: handleAsync(
          async (profileId: number) => {
            await libraryAPI.openMainDatabase(profileId);
            await get().init();
          },
          'Failed to use profile'
        ),
      };
    }),
    { name: 'SearchStore' }
  )
);

