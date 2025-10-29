/**
 * Store Utilities
 * 
 * Common utilities for Zustand stores, including async handler wrapper
 * for loading and error state management.
 * 
 * Following best practices:
 * - Type-safe async handler wrapper
 * - Automatic loading and error state management
 * - Reusable across all stores
 */

import { MdxProfile } from '../types';
import i18n from '../i18n/i18n';

/**
 * Creates an async handler wrapper that manages loading and error states
 * 
 * This function provides automatic:
 * - Loading state management (set to true before call, false after)
 * - Error state clearing before call
 * - Error logging and state setting on failure
 * 
 * Usage example:
 * ```typescript
 * const myAction = withAsyncHandler(
 *   set,
 *   async (param1: string) => {
 *     return await someAPI(param1);
 *   },
 *   'store.settings.setAppOwnerError'
 * );
 * ```
 * 
 * @param set - Zustand set function to update state
 * @param fn - Async function to execute
 * @param errorMessageKey - i18n message key for the error message
 * @returns Wrapped async function with loading and error handling
 */
export function withAsyncHandler<T extends any[], R>(
  set: (partial: Partial<{ loading: boolean; error: string | null }>) => void,
  fn: (...args: T) => Promise<R>,
  errorMessageKey: string
): (...args: T) => Promise<R | undefined> {
  return async (...args: T): Promise<R | undefined> => {
    // Set loading state and clear error before API call
    set({ loading: true, error: null });

    try {
      // Execute the API call
      return await fn(...args);
    } catch (error) {
      // Translate the error message
      const errorMessage = i18n.t(errorMessageKey);
      // Log the error
      console.error(errorMessage + ': ' + ((error as Error).message || (error as Error).toString()));
      set({ error: errorMessage, loading: false });
      return undefined;
    } finally {
      set({ loading: false });
    }
  };
}

export function fts_count(profile: MdxProfile | null): number {
  if (!profile) {
    return 0;
  }
  let count = 0;
  if (profile.profiles && profile.profiles.length > 0) {
    count = profile.profiles.reduce((acc, p) => acc + (p.isFtsEnabled ? 1 : 0), 0);
  }
  if (profile.isFtsEnabled) {
    count++;
  }
  return count;
}

export function index_count(profile: MdxProfile | null): number {
  if (!profile || profile.profileId < 0) {
    return 0;
  }
  return profile.asUnion ? profile.profiles?.length ?? 0 : 1;
}
