/**
 * API Module Exports
 * 
 * Central export point for all API modules.
 * This replaces the old AppContext with modular, focused API modules.
 * 
 * Following best practices:
 * - Separation of concerns (each module handles one domain)
 * - Clean imports (import { libraryAPI } from '../api')
 * - Easy to test and maintain
 */

// Re-export all library APIs
import * as libraryAPI from './library';
import * as searchAPI from './search';
import * as configAPI from './config';
import * as systemAPI from './system';
import * as historyAPI from './history';
import * as favoritesAPI from './favorites';
import * as hotkeyAPI from './hotkey';

export { libraryAPI, searchAPI, configAPI, systemAPI, historyAPI, favoritesAPI, hotkeyAPI };

// Also export individual functions for convenience
export * from './library';
export * from './search';
export * from './config';
export * from './system';
export * from './history';
export * from './favorites';
export * from './hotkey';
