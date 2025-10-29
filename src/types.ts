// Favorite entry with additional metadata
export interface FavoriteEntry {
  id: string;
  keyword: string;
  groupIndex: MdxGroupIndex[]; // Array of MdxGroupIndex (LinkedList in Rust)
  profileId: number;
  profileName: string;
  addedAt: number; // timestamp
}

// History entry with navigation metadata
export interface HistoryEntry {
  id: string;
  keyword: string;
  groupIndex: MdxGroupIndex[]; // Array of MdxGroupIndex (LinkedList in Rust)
  profileId: number;
  profileName: string;
  visitedAt: number; // timestamp
}

// Legacy type for compatibility (to be removed later)
export interface DictionaryEntry {
  id: string;
  word: string;
  content: string;
  phonetic?: string;
}


// MDX Profile types - based on mdx_profile.rs structure
export interface MdxProfile {
  title: string;
  description: string;
  url: string;
  disabled: boolean;
  profileId: number;
  options: MdxOptions;
  isFtsEnabled: boolean;
  
  // Group-related fields (when this profile acts as a group)
  profiles?: MdxProfile[];  // Optional LinkedList of profiles for groups
  asUnion?: boolean;        // as_union field from Rust
  
  // UI state
  isActive?: boolean;       // Indicates if this profile is currently active in main_db
}

export interface MdxOptions {
  fontFilePath: string;
}

// Library view types
export type LibraryViewMode = 'databases' | 'groups';

// Search result types
export interface SearchResultEntry {
  keyword: string;
  entry_count: number;
}

// MDX Index types - corresponding to Rust structs
export interface MdxIndex {
  profile_id: number;
  entry_no: number;
  key: string;
}

// Corresponds to mdx_db_groups::MdxGroupIndex
export interface MdxGroupIndex {
  profile_id: number;
  primary_key: string;
  indexes: MdxIndex[];
}

// Search mode enum
export type SearchMode = 'index' | 'fulltext';

// Sort order for favorites
export type FavoriteSortBy = 'name' | 'time';

// Target information for navigation
export interface TargetInfo {
  profile_id: number;
  entry_no: number;
  fragment: string;
}

