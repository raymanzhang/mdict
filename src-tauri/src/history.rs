// History management module
// Provides data management for history entries with SQLite persistence

use std::sync::{Arc, Mutex};
use rusqlite::{Connection, params, Result as SqlResult};
use serde::{Deserialize, Serialize};

use crate::error::{Result, ZdbError};
use crate::mdx_profile::ProfileId;

/// History entry structure matching frontend HistoryEntry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub keyword: String,
    pub group_index: serde_json::Value, // LinkedList<MdxGroupIndex> as JSON array
    pub profile_id: ProfileId,
    pub profile_name: String,
    pub visited_at: i64, // Unix timestamp in milliseconds
}

/// History manager with SQLite persistence
/// Now uses a shared database connection from DataManager
pub struct HistoryManager {
    conn: Arc<Mutex<Connection>>,
    max_history_size: usize,
}

impl HistoryManager {
    /// Create a new HistoryManager with a shared database connection
    pub fn new(conn: Arc<Mutex<Connection>>) -> Result<Self> {
        // Create table and indexes if not exists
        {
            let c = conn.lock()
                .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;
            
            c.execute(
                "CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    keyword TEXT NOT NULL,
                    group_index TEXT NOT NULL,
                    profile_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    visited_at INTEGER NOT NULL
                )",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create history table: {}", e)))?;

            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC)",
                [],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to create history index: {}", e)))?;
        }
        
        Ok(Self {
            conn,
            max_history_size: 1000,
        })
    }

    /// Add a history entry
    pub fn add_to_history(
        &mut self,
        keyword: String,
        group_index: serde_json::Value,
        profile_id: ProfileId,
        profile_name: String,
    ) -> Result<HistoryEntry> {
        let id = format!("{}-{}-{}", profile_id, keyword, chrono::Utc::now().timestamp_millis());
        let visited_at = chrono::Utc::now().timestamp_millis();
        
        let entry = HistoryEntry {
            id: id.clone(),
            keyword: keyword.clone(),
            group_index: group_index.clone(),
            profile_id,
            profile_name: profile_name.clone(),
            visited_at,
        };

        // Serialize group_index to JSON string for storage
        let group_index_str = serde_json::to_string(&group_index)
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to serialize group_index: {}", e)))?;

        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        conn.execute(
            "INSERT INTO history (id, keyword, group_index, profile_id, profile_name, visited_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, keyword, group_index_str, profile_id, profile_name, visited_at],
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to insert history entry: {}", e)))?;

        // Release lock before trimming
        drop(conn);

        // Trim history if exceeds max size
        self.trim_history()?;

        Ok(entry)
    }

    /// Get all history entries, ordered by visited_at descending
    pub fn get_all_history(&self) -> Result<Vec<HistoryEntry>> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, keyword, group_index, profile_id, profile_name, visited_at 
             FROM history ORDER BY visited_at DESC"
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to prepare query: {}", e)))?;

        let entries = stmt.query_map([], |row| {
            let group_index_str: String = row.get(2)?;
            let group_index = serde_json::from_str(&group_index_str)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    2, 
                    rusqlite::types::Type::Text, 
                    Box::new(e)
                ))?;

            Ok(HistoryEntry {
                id: row.get(0)?,
                keyword: row.get(1)?,
                group_index,
                profile_id: row.get(3)?,
                profile_name: row.get(4)?,
                visited_at: row.get(5)?,
            })
        }).map_err(|e| ZdbError::invalid_data_format(format!("Failed to query history: {}", e)))?
        .collect::<SqlResult<Vec<_>>>()
        .map_err(|e| ZdbError::invalid_data_format(format!("Failed to collect history entries: {}", e)))?;

        Ok(entries)
    }

    /// Get history entry by ID
    pub fn get_entry_by_id(&self, id: &str) -> Result<Option<HistoryEntry>> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, keyword, group_index, profile_id, profile_name, visited_at 
             FROM history WHERE id = ?1"
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to prepare query: {}", e)))?;

        let entry = stmt.query_row([id], |row| {
            let group_index_str: String = row.get(2)?;
            let group_index = serde_json::from_str(&group_index_str)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                    2, 
                    rusqlite::types::Type::Text, 
                    Box::new(e)
                ))?;

            Ok(HistoryEntry {
                id: row.get(0)?,
                keyword: row.get(1)?,
                group_index,
                profile_id: row.get(3)?,
                profile_name: row.get(4)?,
                visited_at: row.get(5)?,
            })
        });

        match entry {
            Ok(e) => Ok(Some(e)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(ZdbError::invalid_data_format(format!("Failed to get history entry: {}", e))),
        }
    }

    /// Remove a history entry by ID
    pub fn remove_from_history(&mut self, id: &str) -> Result<bool> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let affected = conn.execute(
            "DELETE FROM history WHERE id = ?1",
            params![id],
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to delete history entry: {}", e)))?;

        Ok(affected > 0)
    }

    /// Clear all history
    pub fn clear_history(&mut self) -> Result<()> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        conn.execute("DELETE FROM history", [])
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to clear history: {}", e)))?;
        Ok(())
    }

    /// Get history count
    pub fn get_history_count(&self) -> Result<usize> {
        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM history",
            [],
            |row| row.get(0),
        ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to get history count: {}", e)))?;

        Ok(count as usize)
    }

    /// Set maximum history size
    pub fn set_max_history_size(&mut self, size: usize) -> Result<()> {
        self.max_history_size = size;
        self.trim_history()
    }

    /// Get maximum history size
    pub fn get_max_history_size(&self) -> usize {
        self.max_history_size
    }

    /// Trim history to max size (keep most recent entries)
    fn trim_history(&mut self) -> Result<()> {
        let count = self.get_history_count()?;
        if count > self.max_history_size {
            let remove_count = count - self.max_history_size;
            
            let conn = self.conn.lock()
                .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

            conn.execute(
                "DELETE FROM history WHERE id IN (
                    SELECT id FROM history ORDER BY visited_at ASC LIMIT ?1
                )",
                params![remove_count],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to trim history: {}", e)))?;
        }
        Ok(())
    }

    /// Import history entries (for backup/restore)
    pub fn import_history(&mut self, entries: Vec<HistoryEntry>) -> Result<()> {
        // Clear existing history first
        self.clear_history()?;

        let conn = self.conn.lock()
            .map_err(|_| ZdbError::invalid_parameter("Failed to lock database connection".to_string()))?;

        // Insert all entries
        for entry in entries {
            let group_index_str = serde_json::to_string(&entry.group_index)
                .map_err(|e| ZdbError::invalid_data_format(format!("Failed to serialize group_index: {}", e)))?;

            conn.execute(
                "INSERT INTO history (id, keyword, group_index, profile_id, profile_name, visited_at) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    entry.id,
                    entry.keyword,
                    group_index_str,
                    entry.profile_id,
                    entry.profile_name,
                    entry.visited_at
                ],
            ).map_err(|e| ZdbError::invalid_data_format(format!("Failed to import history entry: {}", e)))?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_manager() {
        use std::sync::{Arc, Mutex};
        let conn = Arc::new(Mutex::new(rusqlite::Connection::open(":memory:").unwrap()));
        
        // Create history table for testing
        {
            let c = conn.lock().unwrap();
            c.execute(
                "CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    keyword TEXT NOT NULL,
                    group_index TEXT NOT NULL,
                    profile_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL,
                    visited_at INTEGER NOT NULL
                )",
                [],
            ).unwrap();
        }
        
        let mut manager = HistoryManager::new(conn).unwrap();
        
        let group_index = serde_json::json!([{
            "profile_id": 1,
            "primary_key": "test",
            "indexes": []
        }]);

        // Test add
        let entry = manager.add_to_history(
            "test".to_string(),
            group_index.clone(),
            1,
            "Test Profile".to_string(),
        ).unwrap();

        assert_eq!(entry.keyword, "test");

        // Test get all
        let all = manager.get_all_history().unwrap();
        assert_eq!(all.len(), 1);

        // Test remove
        let removed = manager.remove_from_history(&entry.id).unwrap();
        assert!(removed);

        // Test count after removal
        let count = manager.get_history_count().unwrap();
        assert_eq!(count, 0);
    }
}

