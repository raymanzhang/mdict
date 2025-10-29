/**
 * History Store
 * 
 * Manages history entries with:
 * - Add history entries
 * - Navigate previous/next
 * - Current position tracking
 * - Auto-clear old entries
 * - Persistence via backend SQLite database
 * 
 * Following best practices:
 * - Immer for immutable updates
 * - DevTools for debugging
 * - Backend persistence (SQLite)
 * - Efficient navigation with index tracking
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { HistoryEntry, MdxGroupIndex } from '../types';
import * as historyApi from '../api/history';
import { withAsyncHandler } from '../utils/storeUtils';

interface HistoryState {
  // State
  history: HistoryEntry[];
  currentIndex: number; // Current position in history (-1 if no history)
  maxHistorySize: number; // Maximum number of history entries to keep
  
  // Loading and error state
  loading: boolean;
  error: string | null;
  
  // Computed helpers
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getCurrentEntry: () => HistoryEntry | null;
  
  // Actions
  addToHistory: (
    keyword: string,
    groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
    profileId: number,
    profileName: string
  ) => Promise<void>;
  goBack: () => HistoryEntry | null;
  goForward: () => HistoryEntry | null;
  goToIndex: (index: number) => HistoryEntry | null;
  removeFromHistory: (id: string) => Promise<void>;
  
  // Settings
  setMaxHistorySize: (size: number) => Promise<void>;
  
  // Management
  clearHistory: () => Promise<void>;
  importHistory: (history: HistoryEntry[]) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    immer((set, get) => {
      // Create a bound version of withAsyncHandler for this store
      const handleAsync = <T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        errorMessage: string
      ) => withAsyncHandler(set, fn, errorMessage);

      return {
        // Initial state
        history: [],
        currentIndex: -1,
        maxHistorySize: 1000,
        loading: false,
        error: null,

      // Can navigate back
      canGoBack: () => {
        const { currentIndex } = get();
        return currentIndex > 0;
      },

      // Can navigate forward
      canGoForward: () => {
        const { currentIndex, history } = get();
        return currentIndex < history.length - 1;
      },

      // Get current entry
      getCurrentEntry: () => {
        const { history, currentIndex } = get();
        if (currentIndex >= 0 && currentIndex < history.length) {
          return history[currentIndex];
        }
        return null;
      },

        // Add to history
        addToHistory: handleAsync(
          async (
          keyword: string,
          groupIndex: MdxGroupIndex[], // Array of MdxGroupIndex
          profileId: number,
          profileName: string
        ) => {
          // Add to backend
          const newEntry = await historyApi.addToHistory(keyword, groupIndex, profileId, profileName);
          
          // Update local state
          set((state) => {
            // If we're not at the end of history, truncate forward history
            if (state.currentIndex < state.history.length - 1) {
              state.history = state.history.slice(0, state.currentIndex + 1);
            }

            // Add new entry
            state.history.push(newEntry);
            
            // Set current index to the latest entry
            state.currentIndex = state.history.length - 1;
          });
        },
        'Failed to add to history'
      ),

      // Go back in history
      goBack: () => {
        const { currentIndex, history } = get();
        if (currentIndex > 0) {
          const newIndex = currentIndex - 1;
          set({ currentIndex: newIndex });
          return history[newIndex];
        }
        return null;
      },

      // Go forward in history
      goForward: () => {
        const { currentIndex, history } = get();
        if (currentIndex < history.length - 1) {
          const newIndex = currentIndex + 1;
          set({ currentIndex: newIndex });
          return history[newIndex];
        }
        return null;
      },

      // Go to specific index
      goToIndex: (index: number) => {
        const { history } = get();
        if (index >= 0 && index < history.length) {
          set({ currentIndex: index });
          return history[index];
        }
        return null;
      },

        // Remove from history
        removeFromHistory: handleAsync(
          async (id: string) => {
          // Remove from backend
          await historyApi.removeFromHistory(id);
          
          // Update local state
          set((state) => {
            const index = state.history.findIndex((entry) => entry.id === id);
            if (index !== -1) {
              state.history.splice(index, 1);
              
              // Adjust current index if needed
              if (state.currentIndex >= state.history.length) {
                state.currentIndex = state.history.length - 1;
              } else if (state.currentIndex >= index) {
                state.currentIndex = Math.max(-1, state.currentIndex - 1);
              }
            }
          });
        },
        'Failed to remove from history'
      ),

        // Set max history size
        setMaxHistorySize: handleAsync(
          async (size: number) => {
          // Update backend
          await historyApi.setMaxHistorySize(size);
          
          // Update local state
          set((state) => {
            state.maxHistorySize = size;
          });
          
          // Reload history to reflect trimming
          const history = await historyApi.getAllHistory();
          set({
            history,
            currentIndex: history.length > 0 ? history.length - 1 : -1,
          });
        },
        'Failed to set max history size'
      ),

        // Clear history
        clearHistory: handleAsync(
          async () => {
          // Clear backend
          await historyApi.clearHistory();
          
          // Update local state
          set({ history: [], currentIndex: -1 });
        },
        'Failed to clear history'
      ),

        // Import history (for backup/restore)
        importHistory: handleAsync(
          async (history: HistoryEntry[]) => {
          // Import to backend
          await historyApi.importHistory(history);
          
          // Update local state
          set({
            history,
            currentIndex: history.length > 0 ? history.length - 1 : -1,
          });
        },
        'Failed to import history'
        ),
      };
    }),
    { name: 'HistoryStore' }
  )
);

// Load history on initialization
historyApi.getAllHistory()
  .then((history) => {
    useHistoryStore.setState({
      history,
      currentIndex: history.length > 0 ? history.length - 1 : -1,
    });
  })
  .catch((error) => {
    console.error('Failed to load history:', error);
  });

// Load max history size on initialization
historyApi.getMaxHistorySize()
  .then((size) => {
    useHistoryStore.setState({ maxHistorySize: size });
  })
  .catch((error) => {
    console.error('Failed to load max history size:', error);
  });

