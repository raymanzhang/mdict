/**
 * Favorites Store
 * 
 * Manages favorite entries with:
 * - Add/remove favorites
 * - Sort by name or time
 * - Filter by profile
 * - Persistence via backend SQLite database
 * 
 * Following best practices:
 * - Immer for immutable updates
 * - DevTools for debugging
 * - Backend persistence (SQLite)
 * - Efficient filtering and sorting
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { FavoriteEntry, FavoriteSortBy, MdxGroupIndex } from '../types';
import * as favoritesApi from '../api/favorites';
import { withAsyncHandler } from '../utils/storeUtils';

interface FavoritesState {
  // State
  favorites: FavoriteEntry[];
  sortBy: FavoriteSortBy;
  filterProfileId: number | null; // null means show all
  
  // Loading and error state
  loading: boolean;
  error: string | null;
  
  // Computed/derived state helpers
  getSortedAndFilteredFavorites: () => FavoriteEntry[];
  
  // Actions
  addFavorite: (
    keyword: string,
    groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
    profileId: number,
    profileName: string
  ) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  toggleFavorite: (
    keyword: string,
    groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
    profileId: number,
    profileName: string
  ) => Promise<boolean | undefined>; // Returns true if added, false if removed, undefined on error
  isFavorited: (keyword: string, profileId: number) => boolean;
  
  // Settings
  setSortBy: (sortBy: FavoriteSortBy) => Promise<void>;
  setFilterProfileId: (profileId: number | null) => Promise<void>;
  
  // Management
  clearAllFavorites: () => Promise<void>;
  importFavorites: (favorites: FavoriteEntry[]) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>()(
  devtools(
    immer((set, get) => {
      // Create a bound version of withAsyncHandler for this store
      const handleAsync = <T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        errorMessage: string
      ) => withAsyncHandler(set, fn, errorMessage);

      return {
        // Initial state
        favorites: [],
        sortBy: 'time',
        filterProfileId: null,
        loading: false,
        error: null,

      // Get sorted and filtered favorites
      getSortedAndFilteredFavorites: () => {
        const state = get();
        const { favorites, sortBy, filterProfileId } = state;
        
        // Filter by profile if needed
        let filtered = favorites;
        if (filterProfileId !== null) {
          filtered = favorites.filter((fav) => fav.profileId === filterProfileId);
        }
        
        // Sort
        const sorted = [...filtered].sort((a, b) => {
          if (sortBy === 'name') {
            return a.keyword.localeCompare(b.keyword, 'zh-CN');
          } else {
            // Sort by time (newest first)
            return b.addedAt - a.addedAt;
          }
        });
        
        return sorted;
      },

        // Add favorite
        addFavorite: handleAsync(
          async (
          keyword: string,
          groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
          profileId: number,
          profileName: string
        ) => {
          // Check if already exists locally
          const exists = get().favorites.some(
            (fav) => fav.keyword === keyword && fav.profileId === profileId
          );
          
          if (!exists) {
            // Add to backend
            const newFavorite = await favoritesApi.addFavorite(keyword, groupIndex, profileId, profileName);
            
            // Update local state
            set((state) => {
              state.favorites.push(newFavorite);
            });
          }
        },
        'Failed to add favorite'
      ),

        // Remove favorite
        removeFavorite: handleAsync(
          async (id: string) => {
          // Remove from backend
          await favoritesApi.removeFavorite(id);
          
          // Update local state
          set((state) => {
            state.favorites = state.favorites.filter((fav) => fav.id !== id);
          });
        },
        'Failed to remove favorite'
      ),

        // Toggle favorite (add if not exists, remove if exists)
        toggleFavorite: handleAsync(
          async (
          keyword: string,
          groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
          profileId: number,
          profileName: string
        ) => {
          // Toggle in backend
          const added = await favoritesApi.toggleFavorite(keyword, groupIndex, profileId, profileName);
          
          // Reload favorites from backend
          const favorites = await favoritesApi.getAllFavorites();
          set({ favorites });
          
          return added;
        },
        'Failed to toggle favorite status'
      ),

      // Check if favorited
      isFavorited: (keyword: string, profileId: number) => {
        return get().favorites.some(
          (fav) => fav.keyword === keyword && fav.profileId === profileId
        );
      },

        // Set sort order
        setSortBy: handleAsync(
          async (sortBy: FavoriteSortBy) => {
          set({ sortBy });
          
          // Reload sorted favorites from backend
          const favorites = await favoritesApi.getSortedAndFilteredFavorites(
            sortBy,
            get().filterProfileId
          );
          set({ favorites });
        },
        'Failed to set sort order'
      ),

        // Set filter profile
        setFilterProfileId: handleAsync(
          async (profileId: number | null) => {
          set({ filterProfileId: profileId });
          
          // Reload filtered favorites from backend
          const favorites = await favoritesApi.getSortedAndFilteredFavorites(
            get().sortBy,
            profileId
          );
          set({ favorites });
        },
        'Failed to set filter'
      ),

        // Clear all favorites
        clearAllFavorites: handleAsync(
          async () => {
          // Clear backend
          await favoritesApi.clearAllFavorites();
          
          // Update local state
          set({ favorites: [] });
        },
        'Failed to clear all favorites'
      ),

        // Import favorites (for backup/restore)
        importFavorites: handleAsync(
          async (favorites: FavoriteEntry[]) => {
          // Import to backend
          await favoritesApi.importFavorites(favorites);
          
          // Update local state
          set({ favorites });
        },
        'Failed to import favorites'
        ),
      };
    }),
    { name: 'FavoritesStore' }
  )
);

// Load favorites on initialization
favoritesApi.getAllFavorites()
  .then((favorites) => {
    useFavoritesStore.setState({ favorites });
  })
  .catch((error) => {
    console.error('Failed to load favorites:', error);
  });

