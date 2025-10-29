/**
 * Library Store
 * 
 * Manages library state including:
 * - Database and group listings
 * - Current active profile
 * - Library operations (create, delete, rename groups)
 * 
 * Following best practices:
 * - Immer for immutable updates
 * - DevTools for debugging
 * - Async actions with proper error handling
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { MdxProfile } from '../types';
import * as libraryAPI from '../api/library';
import i18n from '../i18n/i18n';

interface LibraryState {
  // Current state
  groups: MdxProfile[];
  
  // Loading and error state
  loading: boolean;
  error: string | null;
  
  // Actions
  loadGroups: () => Promise<void>;
  getProfile: (groupId: number, profileId: number) => MdxProfile|undefined;
  getGroup: (groupId: number) => MdxProfile|undefined;
  refreshLibrary: () => Promise<void>;
  createGroup: (groupName: string) => Promise<number>;
  deleteGroup: (groupId: number) => Promise<void>;
  renameGroup: (groupId: number, newName: string) => Promise<void>;
  updateProfileDisabledStatus: (
    parentGroupId: number,
    profileId: number,
    disabled: boolean
  ) => Promise<void>;
  adjustProfileOrder: (
    parentGroupId: number,
    profileId: number,
    newIndex: number
  ) => Promise<void>;
  adjustGroupOrder: (groupId: number, newIndex: number) => Promise<void>;
  
}

export const useLibraryStore = create<LibraryState>()(
  devtools(
    immer((set, get) => {
      /**
       * Helper function to wrap async API calls with loading and error handling
       * 
       * This function provides automatic:
       * - Loading state management (set to true before call, false after)
       * - Error state clearing before call
       * - Error logging and state setting on failure
       * - Optional error rethrowing for caller handling
       * 
       * @param fn - Async function to execute
       * @param errorMessage - Error message to display on failure
       * @returns Wrapped async function with loading and error handling
       */
      
      // Overload for rethrow: true - guarantees return type or throws
      function withAsyncHandler<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        reloadGroups: boolean,
        errorMessage: string
      ): (...args: T) => Promise<R>;
      
      // Overload for rethrow: false or undefined - may return undefined
      function withAsyncHandler<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        reloadGroups: boolean,
        errorMessage: string
      ): (...args: T) => Promise<R | undefined>;
      
      // Implementation
      function withAsyncHandler<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        reloadGroups: boolean,
        errorMessageKey: string
      ) {

        return async (...args: T): Promise<R | undefined> => {
          // Set loading state and clear error before API call
          set({ loading: true, error: null });

          try {
            // Execute the API call
            const result = await fn(...args);
            if (reloadGroups) {
              await get().loadGroups();
            }
            return result;
          } catch (error) {
            // Translate the error message
            const errorMessage = i18n.t(errorMessageKey);
            // Log the error
            console.error(errorMessage+': '+(error as Error).message || (error as Error).toString());
            set({ error: errorMessage });
            return undefined;
          } finally {
            set({ loading: false });
          }
        }
      }

      return {
        // Initial state
        groups: [],
        currentProfile: null,
        currentProfileId: null,
        loading: false,
        error: null,

        // Load groups
        loadGroups: withAsyncHandler(
          async () => {
            const groups = await libraryAPI.listGroups();
            set({ groups });
          },
          false,
          'Failed to load dictionary groups'
        ),

        // Get profile
        getProfile: (groupId: number, profileId: number) => {
          return get().groups
            .find(group => group.profileId === groupId)
            ?.profiles?.find(profile => profile.profileId === profileId);
        },

        getGroup: (groupId: number) => {
          return get().groups.find(group => group.profileId === groupId);
        },
        
        // Refresh library
        refreshLibrary: withAsyncHandler(
          libraryAPI.refreshLibrary,
          true,
          'Failed to refresh library'
        ),

        // Create group
        createGroup: withAsyncHandler(
          async (groupName: string) => {
            const groupId = await libraryAPI.createDictGroup(groupName);
            return groupId;
          },
          true,
          'Failed to create dictionary group',
        ),

        // Delete group
        deleteGroup: withAsyncHandler(
          async (groupId: number) => {
            await libraryAPI.deleteDictGroup(groupId);
          },
          true,
          'Failed to delete dictionary group',
        ),

        // Rename group
        renameGroup: withAsyncHandler(
          async (groupId: number, newName: string) => {
            await libraryAPI.renameDictGroup(groupId, newName);
          },
          true,
          'Failed to rename dictionary group',
        ),

        // Update profile disabled status
        updateProfileDisabledStatus: withAsyncHandler(
          async (
            parentGroupId: number,
            profileId: number,
            disabled: boolean
          ) => {
            await libraryAPI.updateProfileDisabledStatus(
              parentGroupId,
              profileId,
              disabled
            );
          },
          true,
          'Failed to update dictionary status',
        ),

        // Adjust profile order
        adjustProfileOrder: withAsyncHandler(
          async (
            parentGroupId: number,
            profileId: number,
            newIndex: number
          ) => {
            await libraryAPI.adjustProfileOrder(parentGroupId, profileId, newIndex);
          },
          true,
          'Failed to adjust dictionary order',
        ),

        // Adjust group order
        adjustGroupOrder: withAsyncHandler(
          async (groupId: number, newIndex: number) => {
            await libraryAPI.adjustGroupOrder(groupId, newIndex);
          },
          true,
          'Failed to adjust group order',
        )

      };
    }),
    { name: 'LibraryStore' }
  )
);

