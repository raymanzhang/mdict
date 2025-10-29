use std::collections::LinkedList;
use serde::{Serialize, Deserialize};
use url::Url;

use mdx::{Result, MdxReader};
use mdx::storage::{KeyIndex, EntryNo};
use mdx::utils::MdxHtmlRewriter;

use crate::mdx_profile::{MdxProfile, ProfileId};


#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct MdxIndex {
    pub profile_id: ProfileId,
    pub key_index: KeyIndex,
}

pub struct MdxDb {
    pub profile: MdxProfile,
    pub mdx_reader: MdxReader,

}

impl MdxDb {
    pub fn new(profile: &MdxProfile, device_id: &str) -> Result<Self> {
        let mdx_reader = MdxReader::from_url(
            &Url::parse(&profile.url)?,
            device_id,
        )?;
        
        Ok(Self {
            profile: profile.clone(),
            mdx_reader,            
        })
    }
    
    pub fn get_title(&self) -> &String{
        &self.mdx_reader.db_name
    }

    pub fn get_description(&self) -> String{
        self.mdx_reader.content_db.meta.db_info.description.clone()
    }

    pub fn get_entry_count(&self) -> u64 {
        self.mdx_reader.get_entry_count()
    }

    pub fn get_index(&mut self, entry_no: EntryNo) -> Result<MdxIndex> {
        Ok(MdxIndex {
            profile_id: self.profile.profile_id,
            key_index: self.mdx_reader.get_index(entry_no)?.into(),
        })
    }

    pub fn get_indexes(&mut self, start_entry_no: EntryNo, max_count: u64) -> Result<LinkedList<MdxIndex>> {
        let indexes = self.mdx_reader.get_indexes(start_entry_no, max_count)?;
        let mut mdx_indexes = LinkedList::new();
        for index in indexes {
            mdx_indexes.push_back(MdxIndex {
                profile_id: self.profile.profile_id,
                key_index: index.into(),
            });
        }
        Ok(mdx_indexes)
    }

    pub fn find_index(&mut self, key: &str, prefix_match: bool, partial_match: bool, best_match: bool) -> Result<Option<MdxIndex>> {
        let key_index = self.mdx_reader.find_index(key, prefix_match, partial_match, best_match)?;
        if let Some(key_index) = key_index {
            Ok(Some(MdxIndex {
                profile_id: self.profile.profile_id,
                key_index: key_index.into(),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn normalize_keyword(keyword: &str) -> String {
        keyword.chars()
            .filter(|c| c.is_alphabetic())
            .map(|c| c.to_lowercase().collect::<String>())
            .collect::<String>()
    }

    pub fn find_similar_index(&mut self, key: &str, prefix_match: bool, partial_match: bool, best_match: bool, max_results: usize) -> Result<LinkedList<MdxIndex>> {
        let key_index = self.mdx_reader.find_index(key, prefix_match, partial_match, best_match)?;
        let mut mdx_indexes = LinkedList::new();
        if let Some(key_index) = key_index {
            mdx_indexes.push_back(MdxIndex {
                profile_id: self.profile.profile_id,
                key_index: key_index.clone(),
            });
            let normalized_key = Self::normalize_keyword(&key_index.key);
            for i in 1 .. std::cmp::min(max_results as u64, self.get_entry_count() - key_index.entry_no as u64) {
                let index = self.mdx_reader.get_index(key_index.entry_no + i as EntryNo)?;
                if normalized_key == Self::normalize_keyword(&index.key) {
                    mdx_indexes.push_back(MdxIndex {
                        profile_id: self.profile.profile_id,
                        key_index: index.into(),
                    });
                }else {
                    break;
                }
            }
        } 
        Ok(mdx_indexes)
    }
    
    //Get the contents of the entry
    pub fn get_html(&mut self, entry: &MdxIndex, base_url:&str)->Result<String> {
        let key_index: KeyIndex = entry.key_index.clone().into();
        MdxHtmlRewriter::rewrite_html_with_base_url(&self.mdx_reader.get_html(&key_index)?, self.profile.profile_id, base_url)
    }

    pub fn get_data(&mut self, file_path:&str) -> Result<Option<(Vec<u8>, String)>> {
        self.mdx_reader.get_data(file_path)
    }

    /// Perform full-text search on the database content
    /// Returns a vector of MdxIndex results with their search scores
    pub fn fulltext_find(&mut self, query: &str, max_results: usize) -> Result<Vec<(f32, MdxIndex)>> {
        let search_results = self.mdx_reader.fts_search(query, max_results)?;
        let mut mdx_results = Vec::new();
        
        for (score, entry_no, _key) in search_results {
            let key_index = self.mdx_reader.get_index(entry_no)?;
            let mdx_index = MdxIndex {
                profile_id: self.profile.profile_id,
                key_index: key_index.into(),
            };
            mdx_results.push((score, mdx_index));
        }
        
        Ok(mdx_results)
    }

    /// Check if full-text search is available for this database
    pub fn is_fts_available(&self) -> bool {
        self.mdx_reader.is_fts_available()
    }
}