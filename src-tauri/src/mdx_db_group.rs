use std::collections::{HashMap, LinkedList};

use mdx::{Result, ZdbError};

use crate::mdx_db::{MdxDb, MdxIndex};
use crate::mdx_profile::{MdxProfile, ProfileId};

#[derive(Default, Debug, Clone, serde::Serialize)]
pub struct MdxGroupIndex {
    pub profile_id: ProfileId,
    pub primary_key: String,
    pub indexes: LinkedList<MdxIndex>,
}

pub struct MdxDbGroup {
    pub profile: MdxProfile,
    pub mdx_dbs: HashMap<ProfileId, MdxDb>,
}

impl MdxDbGroup {
    pub fn new(profile: &MdxProfile, device_id: &str) -> Result<Self> {
        if !profile.as_union || profile.get_profiles().is_none() {
            return Err(ZdbError::invalid_parameter("Not a union group or no sub profiles"));
        }
        let mut mdx_dbs = HashMap::new();
        for profile in profile.get_profiles().unwrap().iter() {
            if !profile.disabled {
                let mdx_db = MdxDb::new(profile, device_id)?;
                mdx_dbs.insert(profile.profile_id, mdx_db);
            }
        }
        Ok(Self { profile: profile.clone(), mdx_dbs })
    }

    pub fn find_best_match_indexes(&mut self, query: &str, max_results_per_lib: usize) -> Result<LinkedList<(String, String, LinkedList<MdxGroupIndex>)>> {
        // Map normalized_key -> (display_key, Map<profile_id, LinkedList<MdxIndex>>)
        let mut merged_results = std::collections::BTreeMap::<
            String,
            (
                String,
                std::collections::BTreeMap<crate::mdx_profile::ProfileId, LinkedList<crate::mdx_db::MdxIndex>>,
            ),
        >::new();

        let normalized_query = MdxDb::normalize_keyword(query);
        // Search in each library within the group
        for mdx_db in self.mdx_dbs.values_mut() {
            if let Some(best_match) = mdx_db.find_index(query, true, true, true)? {
                let start_entry = best_match.key_index.entry_no;
                if let Ok(indexes) = mdx_db.get_indexes(start_entry, max_results_per_lib as u64) {
                    for index in indexes {
                        // Normalize keyword for merging (ignore case and non-alphabetic characters)
                        let normalized_key = MdxDb::normalize_keyword(&index.key_index.key);
                        let original_key = index.key_index.key.clone();

                        if normalized_key<normalized_query {
                            continue;
                        }else if merged_results.len() > max_results_per_lib && &normalized_key>merged_results.last_entry().unwrap().key()  {
                            break;
                        }
                        // Ensure entry for normalized key exists with display key
                        let entry = merged_results
                            .entry(normalized_key)
                            .or_insert_with(|| (original_key, std::collections::BTreeMap::new()));

                        // Group indexes by profile_id under this key
                        let per_profile_indexes = entry
                            .1
                            .entry(index.profile_id)
                            .or_insert_with(|| LinkedList::new());
                        per_profile_indexes.push_back(index);

                        if merged_results.len() > max_results_per_lib{
                            merged_results.pop_last();
                        }
                    }
                }
            }
        }

        // Build results: each key maps to a LinkedList of MdxGroupIndex,
        // where each MdxGroupIndex contains indexes from a single profile_id
        // Sort by profile order in the group's profile list
        let mut results = LinkedList::new();
        for (normalized_key, (display_key, per_profile_map)) in merged_results {
            let mut group_index_list = LinkedList::new();
            
            // Sort profile_ids by their order in the group's profiles list
            if let Some(profiles) = self.profile.get_profiles() {
                for profile in profiles.iter() {
                    if let Some(indexes) = per_profile_map.get(&profile.profile_id) {
                        let group_index = MdxGroupIndex {
                            profile_id: profile.profile_id,
                            primary_key: display_key.clone(),
                            indexes: indexes.clone(),
                        };
                        group_index_list.push_back(group_index);
                    }
                }
            }
            
            results.push_back((normalized_key, display_key, group_index_list));
        }

        Ok(results)
    }
    
    /// Perform full-text search across all libraries in the group
    /// Behavior is similar to `MdxDbGroup::find_index`, but uses `MdxDb::search_fulltext`
    /// to collect results per library, then merges them by normalized key
    pub fn fulltext_find(&mut self, query: &str, max_results_per_lib: usize) -> Result<LinkedList<(String, String, LinkedList<MdxGroupIndex>)>> {
        // Map normalized_key -> (display_key, Map<profile_id, LinkedList<MdxIndex>>)
        let mut merged_results = std::collections::BTreeMap::<
            String,
            (
                String,
                std::collections::BTreeMap<crate::mdx_profile::ProfileId, LinkedList<crate::mdx_db::MdxIndex>>,
            ),
        >::new();

        // Search in each library within the group using full-text search when available
        for mdx_db in self.mdx_dbs.values_mut() {
            if !mdx_db.is_fts_available() { continue; }

            if let Ok(results) = mdx_db.fulltext_find(query, max_results_per_lib) {
                for (_score, index) in results {
                    // Normalize keyword for merging (ignore case and non-alphabetic characters)
                    let normalized_key = MdxDb::normalize_keyword(&index.key_index.key);
                    let original_key = index.key_index.key.clone();

                    // Ensure entry for normalized key exists with display key
                    let entry = merged_results
                        .entry(normalized_key)
                        .or_insert_with(|| (original_key, std::collections::BTreeMap::new()));

                    // Group indexes by profile_id under this key
                    let per_profile_indexes = entry
                        .1
                        .entry(index.profile_id)
                        .or_insert_with(|| LinkedList::new());
                    per_profile_indexes.push_back(index);
                }
            }
        }

        // Build results: each key maps to a LinkedList of MdxGroupIndex,
        // where each MdxGroupIndex contains indexes from a single profile_id
        // Sort by profile order in the group's profile list
        let mut results = LinkedList::new();
        for (_normalized_key, (display_key, per_profile_map)) in merged_results {
            let mut group_index_list = LinkedList::new();
            
            // Sort profile_ids by their order in the group's profiles list
            if let Some(profiles) = self.profile.get_profiles() {
                for profile in profiles.iter() {
                    if let Some(indexes) = per_profile_map.get(&profile.profile_id) {
                        let group_index = MdxGroupIndex {
                            profile_id: profile.profile_id,
                            primary_key: display_key.clone(),
                            indexes: indexes.clone(),
                        };
                        group_index_list.push_back(group_index);
                    }
                }
            }
            
            // Use normalized value of display_key as the map key similar to find_index
            let normalized_key = MdxDb::normalize_keyword(&display_key);
            results.push_back((normalized_key, display_key, group_index_list));
        }

        Ok(results)
    }
    
    pub fn get_html(&mut self, entry: &MdxIndex, base_url: &str)->Result<String> {
        let mdx_db = self.mdx_dbs.get_mut(&entry.profile_id).unwrap();
        mdx_db.get_html(entry, base_url)
    }
    
    pub fn is_fts_available(&self) -> bool {
        for mdx_db in self.mdx_dbs.values() {
            if mdx_db.is_fts_available() {
                return true;
            }
        }
        false
    }
}