// Favorites management module
// Provides data management for favorite entries with SQLite persistence

use std::sync::{Arc, Mutex};
use rusqlite::{Connection, params, Result as SqlResult};
use serde::{Deserialize, Serialize};

use crate::error::{Result, ZdbError};
use crate::mdx_profile::ProfileId;

/// Favorite entry structure matching frontend FavoriteEntry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntry {
    pub id: String,
    pub keyword: String,
    pub group_index: serde_json::Value, // LinkedList<MdxGroupIndex> as JSON array
    pub profile_id: ProfileId,
    pub profile_name: String,
    pub added_at: i64, // Unix timestamp in milliseconds
}

/// Sort order for favorites
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FavoriteSortBy {
    Name,
    Time,
}

/// Favorites manager with SQLite persistence
/// Now uses a shared database connection from DataManager
pub struct FavoritesManager {
    conn: Arc<Mutex<Connection>>,
}

impl FavoritesManager {
    /// Create a new FavoritesManager with a shared database connection
    pub fn new(conn: Arc<Mutex<Connection>>) -> Result<Self> {
        // Create table and indexes if not exists
        {
            let c = conn.lock()
                .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;
            
            c.execute(
                "CREATE TABLE IF NOT EXISTS favorites (
                    id TEXT PRIMARY KEY,
                    keyword TEXT NOT NULL,
                    group_index TEXT NOT NULL,
                    profile_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    added_at INTEGER NOT NULL
                )",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create favorites table: {}", e)))?;

            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_favorites_added_at ON favorites(added_at DESC)",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create favorites index on added_at: {}", e)))?;

            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON favorites(keyword COLLATE NOCASE)",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create favorites index on keyword: {}", e)))?;

            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_favorites_profile_id ON favorites(profile_id)",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create favorites index on profile_id: {}", e)))?;
        }
        
        Ok(Self { conn })
    }

    /// Add a favorite entry
    pub fn add_favorite(
        &mut self,
        keyword: String,
        group_index: serde_json::Value,
        profile_id: ProfileId,
        profile_name: String,
    ) -> Result<FavoriteEntry> {
        // Check if already exists
        if self.is_favorited(&keyword, profile_id)? {
            return Err(ZdbError::invalid_parameter(format!(
                "Favorite already exists: {} (profile: {})",
                keyword, profile_id
            )));
        }

        let id = format!("{}-{}-{}", profile_id, keyword, chrono::Utc::now().timestamp_millis());
        let added_at = chrono::Utc::now().timestamp_millis();
        
        let entry = FavoriteEntry {
            id: id.clone(),
            keyword: keyword.clone(),
            group_index: group_index.clone(),
            profile_id,
            profile_name: profile_name.clone(),
            added_at,
        };

        // Serialize group_index to JSON string for storage
        let group_index_str = serde_json::to_string(&group_index)
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to serialize group_index: {}", e)))?;

        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        conn.execute(
            "INSERT INTO favorites (id, keyword, group_index, profile_id, profile_name, added_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, keyword, group_index_str, profile_id, profile_name, added_at],
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to insert favorite entry: {}", e)))?;

        Ok(entry)
    }

    /// Remove a favorite entry by ID
    pub fn remove_favorite(&mut self, id: &str) -> Result<bool> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let affected = conn.execute(
            "DELETE FROM favorites WHERE id = ?1",
            params![id],
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to delete favorite entry: {}", e)))?;

        Ok(affected > 0)
    }

    /// Toggle favorite (add if not exists, remove if exists) - returns the favorite that was added/removed
    pub fn toggle_favorite(
        &mut self,
        keyword: String,
        group_index: serde_json::Value,
        profile_id: ProfileId,
        profile_name: String,
    ) -> Result<(bool, Option<FavoriteEntry>)> {
        // Check if exists
        if let Some(existing) = self.find_favorite(&keyword, profile_id)? {
            self.remove_favorite(&existing.id)?;
            Ok((false, Some(existing)))
        } else {
            let entry = self.add_favorite(keyword, group_index, profile_id, profile_name)?;
            Ok((true, Some(entry)))
        }
    }

    /// Check if favorited
    pub fn is_favorited(&self, keyword: &str, profile_id: ProfileId) -> Result<bool> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE keyword = ?1 AND profile_id = ?2",
            params![keyword, profile_id],
            |row| row.get(0),
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to check if favorited: {}", e)))?;

        Ok(count > 0)
    }

    /// Find a favorite entry by keyword and profile_id
    fn find_favorite(&self, keyword: &str, profile_id: ProfileId) -> Result<Option<FavoriteEntry>> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, keyword, group_index, profile_id, profile_name, added_at 
             FROM favorites WHERE keyword = ?1 AND profile_id = ?2"
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to prepare query: {}", e)))?;

        let entry = stmt.query_row(params![keyword, profile_id], |row| {
            let group_index_str: String = row.get(2)?;
            let group_index = serde_json::from_str(&group_index_str)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    2, 
                    rusqlite::types::Type::Text, 
                    Box::new(e)
                ))?;

            Ok(FavoriteEntry {
                id: row.get(0)?,
                keyword: row.get(1)?,
                group_index,
                profile_id: row.get(3)?,
                profile_name: row.get(4)?,
                added_at: row.get(5)?,
            })
        });

        match entry {
            Ok(e) => Ok(Some(e)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(ZdbError::invalid_data_format(format!("Failed to find favorite: {}", e))),
        }
    }

    /// Get sorted and filtered favorites
    pub fn get_sorted_and_filtered_favorites(
        &self,
        sort_by: FavoriteSortBy,
        filter_profile_id: Option<ProfileId>,
    ) -> Result<Vec<FavoriteEntry>> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match filter_profile_id {
            Some(profile_id) => {
                let sql = format!(
                    "SELECT id, keyword, group_index, profile_id, profile_name, added_at 
                     FROM favorites WHERE profile_id = ?1 ORDER BY {}",
                    match sort_by {
                        FavoriteSortBy::Name => "keyword COLLATE NOCASE ASC",
                        FavoriteSortBy::Time => "added_at DESC",
                    }
                );
                (sql, vec![Box::new(profile_id)])
            }
            None => {
                let sql = format!(
                    "SELECT id, keyword, group_index, profile_id, profile_name, added_at 
                     FROM favorites ORDER BY {}",
                    match sort_by {
                        FavoriteSortBy::Name => "keyword COLLATE NOCASE ASC",
                        FavoriteSortBy::Time => "added_at DESC",
                    }
                );
                (sql, vec![])
            }
        };

        let mut stmt = conn.prepare(&query)
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to prepare query: {}", e)))?;

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let entries = stmt.query_map(param_refs.as_slice(), |row| {
            let group_index_str: String = row.get(2)?;
            let group_index = serde_json::from_str(&group_index_str)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    2, 
                    rusqlite::types::Type::Text, 
                    Box::new(e)
                ))?;

            Ok(FavoriteEntry {
                id: row.get(0)?,
                keyword: row.get(1)?,
                group_index,
                profile_id: row.get(3)?,
                profile_name: row.get(4)?,
                added_at: row.get(5)?,
            })
        }).map_err(|e| ZdbError::invalid_data_format(format!("Failed to query favorites: {}", e)))?
        .collect::<SqlResult<Vec<_>>>()
        .map_err(|e| ZdbError::invalid_data_format(format!("Failed to collect favorites: {}", e)))?;

        Ok(entries)
    }

    /// Get all favorites (no sorting or filtering)
    pub fn get_all_favorites(&self) -> Result<Vec<FavoriteEntry>> {
        self.get_sorted_and_filtered_favorites(FavoriteSortBy::Time, None)
    }

    /// Clear all favorites
    pub fn clear_all_favorites(&mut self) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        conn.execute("DELETE FROM favorites", [])
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to clear favorites: {}", e)))?;
        Ok(())
    }

    /// Import favorites (for backup/restore)
    pub fn import_favorites(&mut self, entries: Vec<FavoriteEntry>) -> Result<()> {
        // Clear existing favorites first
        self.clear_all_favorites()?;

        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        // Insert all entries
        for entry in entries {
            let group_index_str = serde_json::to_string(&entry.group_index)
                .map_err(|e| ZdbError::invalid_data_format(format!("Failed to serialize group_index: {}", e)))?;

            conn.execute(
                "INSERT INTO favorites (id, keyword, group_index, profile_id, profile_name, added_at) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    entry.id,
                    entry.keyword,
                    group_index_str,
                    entry.profile_id,
                    entry.profile_name,
                    entry.added_at
                ],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to import favorite entry: {}", e)))?;
        }

        Ok(())
    }

    /// Get favorites count
    pub fn get_favorites_count(&self) -> Result<usize> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites",
            [],
            |row| row.get(0),
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to get favorites count: {}", e)))?;

        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_favorites_manager() {
        use std::sync::{Arc, Mutex};
        let conn = Arc::new(Mutex::new(rusqlite::Connection::open(":memory:").unwrap()));
        
        // Create favorites table for testing
        {
            let c = conn.lock().unwrap();
            c.execute(
                "CREATE TABLE IF NOT EXISTS favorites (
                    id TEXT PRIMARY KEY,
                    keyword TEXT NOT NULL,
                    group_index TEXT NOT NULL,
                    profile_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    added_at INTEGER NOT NULL
                )",
                [],
            ).unwrap();
        }
        
        let mut manager = FavoritesManager::new(conn).unwrap();
        
        let group_index = serde_json::json!([{
            "profile_id": 1,
            "primary_key": "test",
            "indexes": []
        }]);

        // Test add
        let entry = manager.add_favorite(
            "test".to_string(),
            group_index.clone(),
            1,
            "Test Profile".to_string(),
        ).unwrap();

        assert_eq!(entry.keyword, "test");

        // Test is_favorited
        assert!(manager.is_favorited("test", 1).unwrap());

        // Test toggle (should remove)
        let (added, _) = manager.toggle_favorite(
            "test".to_string(),
            group_index.clone(),
            1,
            "Test Profile".to_string(),
        ).unwrap();
        assert!(!added);

        // Test count after toggle
        let count = manager.get_favorites_count().unwrap();
        assert_eq!(count, 0);
    }
}

