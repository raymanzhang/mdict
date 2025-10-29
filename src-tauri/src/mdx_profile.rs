use std::collections::LinkedList;
use serde::{Deserialize, Serialize};
use url::Url;

use mdx::utils::{get_decoded_file_stem, with_extension};


pub type ProfileId = i32;

pub const DEFAULT_GROUP_ID: ProfileId = 1;
pub const INVALID_PROFILE_ID: ProfileId = -1;


#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MdxOptions {
    pub font_file_path: String,
}

#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MdxProfile {
    pub title: String,
    pub description: String,
    pub url: String,
    pub disabled: bool,
    pub profile_id: ProfileId,
    pub options: MdxOptions,
        
    // Group-related fields (when this profile acts as a group)
    #[serde(default)]
    pub profiles: Option<LinkedList<MdxProfile>>,
    #[serde(default)]
    pub as_union: bool,
}

// Custom Serialize implementation to include computed is_fts_enabled field
impl Serialize for MdxProfile {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        
        let mut state = serializer.serialize_struct("MdxProfile", 9)?;
        state.serialize_field("title", &self.title)?;
        state.serialize_field("description", &self.description)?;
        state.serialize_field("url", &self.url)?;
        state.serialize_field("disabled", &self.disabled)?;
        state.serialize_field("profileId", &self.profile_id)?;
        state.serialize_field("options", &self.options)?;
        state.serialize_field("profiles", &self.profiles)?;
        state.serialize_field("asUnion", &self.as_union)?;
        state.serialize_field("isFtsEnabled", &self.is_fts_enabled())?;
        state.end()
    }
}

impl MdxProfile {
    /// Check if this profile acts as a group
    pub fn is_group(&self) -> bool {
        self.profiles.is_some()
    }

    pub fn is_fts_enabled(&self) -> bool {
        if let Some(profiles) = &self.profiles {
            return profiles.iter().any(|p| p.is_fts_enabled());
        }else{
            let idx_url = with_extension(&Url::parse(&self.url).unwrap(), "idx").unwrap();
            return idx_url.to_file_path().unwrap().exists();    
        }
    }

    /// Get profiles if this is a group
    pub fn get_profiles(&self) -> Option<&LinkedList<MdxProfile>> {
        self.profiles.as_ref()
    }

    /// Get mutable profiles if this is a group
    pub fn get_profiles_mut(&mut self) -> Option<&mut LinkedList<MdxProfile>> {
        self.profiles.as_mut()
    }


    /// Get a profile by ID if this is a group
    pub fn get_profile(&self, profile_id: ProfileId) -> Option<&MdxProfile> {
        self.profiles.as_ref()?.iter().find(|p| p.profile_id == profile_id)
    }

    /// Get a mutable profile by ID if this is a group
    pub fn get_profile_mut(&mut self, profile_id: ProfileId) -> Option<&mut MdxProfile> {
        self.profiles.as_mut()?.iter_mut().find(|p| p.profile_id == profile_id)
    }

    /// Replace or add a profile in this group
    /// 
    /// # Arguments
    /// * `mdx_profile` - The profile to add or replace
    /// * `next_id` - The ID to assign if this is a new profile
    pub fn replace_profile(&mut self, mdx_profile: &MdxProfile, next_id: ProfileId) {
        if self.profiles.is_none() {
            self.profiles = Some(LinkedList::new());
        }
        
        let profiles = self.profiles.as_mut().unwrap();
        let profile = profiles.iter_mut().find(|p| p.profile_id == mdx_profile.profile_id);
        if let Some(profile) = profile {
            *profile = mdx_profile.clone();
        } else {
            let mut new_profile = mdx_profile.clone();
            new_profile.profile_id = next_id;
            profiles.push_back(new_profile);
        }
    }


    /// Adjust profile order within this group
    pub fn adjust_profile_order(&mut self, profile_id: ProfileId, new_index: usize) {
        if let Some(profiles) = &mut self.profiles {
            let mut target_profile: Option<MdxProfile> = None;
            let mut new_profiles = LinkedList::new();
            
            // Collect all profiles except the target
            for profile in profiles.iter() {
                if profile.profile_id != profile_id {
                    new_profiles.push_back(profile.clone());
                } else {
                    target_profile = Some(profile.clone());
                }
            }
            
            // Insert the target profile at the new position
            if let Some(profile) = target_profile {
                let mut result_profiles = LinkedList::new();
                let mut current_index = 0;
                
                for existing_profile in new_profiles.iter() {
                    if current_index == new_index {
                        result_profiles.push_back(profile.clone());
                    }
                    result_profiles.push_back(existing_profile.clone());
                    current_index += 1;
                }
                
                // If new_index is beyond the range, add the profile at the end
                if new_index >= new_profiles.len() {
                    result_profiles.push_back(profile);
                }
                
                *profiles = result_profiles;
            }
        }
    }

    /// Create a new profile (group or individual)
    /// 
    /// # Arguments
    /// * `title_or_url` - For groups: the title; For individual profiles: the URL
    /// * `profile_id` - The unique ID for this profile
    /// * `is_group` - If true, creates a group profile; if false, creates an individual profile
    pub fn new(title_or_url: String, profile_id: ProfileId, is_group: bool) -> Self {
        if is_group {
            // For groups: title_or_url is the title, url is empty
            Self {
                title: title_or_url,
                description: String::new(),
                url: String::new(),
                disabled: false,
                profile_id,
                options: MdxOptions::default(),
                profiles: Some(LinkedList::new()),
                as_union: true,
            }
        } else {
            // For individual profiles: title_or_url is the URL, title is derived from URL
            let url = Url::parse(&title_or_url).unwrap_or(Url::parse("file://").unwrap());
            let title = get_decoded_file_stem(&url).unwrap_or_default();
            Self {
                title,
                description: String::new(),
                url: title_or_url,
                disabled: false,
                profile_id,
                options: MdxOptions::default(),
                profiles: None,
                as_union: false,
            }
        }
    }

    /// Create a new group profile (convenience method)
    pub fn new_group(title: String, profile_id: ProfileId) -> Self {
        Self::new(title, profile_id, true)
    }

    /// Create a new individual profile (convenience method)
    pub fn new_profile(title: String, url: String, profile_id: ProfileId) -> Self {
        let mut profile = Self::new(url, profile_id, false);
        profile.title = title; // Override the auto-derived title with the provided one
        profile
    }
}