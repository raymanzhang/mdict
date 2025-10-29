use std::collections::{LinkedList, HashMap};
use std::path::{Path, PathBuf};
use mime_guess::MimeGuess;
use regex::Regex;
use serde::{Deserialize, Serialize};
use url::Url;

use mdx::ZdbError;
use mdx::utils::{scan_dir, get_decoded_path, replace_url_path, with_extension};

use crate::error::Result;
use crate::mdx_profile::{self, MdxOptions, MdxProfile, ProfileId, DEFAULT_GROUP_ID};

/// MDX库管理器
/// 基于mdx_manager的简化版本
#[derive(Deserialize, Serialize)]
pub struct LibraryManager {
    mdx_groups: LinkedList<MdxProfile>,
    /// 默认MDX选项
    #[serde(skip)]
    default_mdx_options: MdxOptions,

    #[serde(skip)]
    library_file_path: String,

    #[serde(skip)]
    icon_cache: HashMap<ProfileId, (Vec<u8>, String)>,
}

impl LibraryManager {
    pub fn new() -> Self {
        let mut manager = Self { 
            mdx_groups: LinkedList::new(),
            default_mdx_options: MdxOptions::default(),
            library_file_path: String::new(),
            icon_cache: HashMap::new(),
        };
        manager.ensure_default_group();
        manager
    }

    pub fn get_next_profile_id(&self) -> ProfileId {
        let mut ids = Vec::new();
        for group in &self.mdx_groups {
            ids.push(group.profile_id);
            if let Some(profiles) = &group.profiles {
                for profile in profiles {
                    ids.push(profile.profile_id);
                }
            }
        }
        let max_id = ids.into_iter().max().unwrap_or(0);
        max_id + 1
    }

    /// Ensure the default "All" group exists
    fn ensure_default_group(&mut self) {
        // Check if the default group already exists
        if self.get_group(DEFAULT_GROUP_ID).is_none() {
            let root_group = MdxProfile::new_group("All databases".to_string(), DEFAULT_GROUP_ID);
            self.replace_group_profile(&root_group);
        }
    }

    /// 通过profile_id查找任意profile（可能是group或individual profile）
    pub fn find_profile(&self, profile_id: ProfileId) -> Option<&MdxProfile> {
        // First try to find it in groups
        if let Some(group) = self.mdx_groups.iter().find(|p| p.profile_id == profile_id) {
            return Some(group);
        }
        //If profile_id can't be found in groups, then only try find it in default group
        return self.mdx_groups.iter().find(|p| p.profile_id == DEFAULT_GROUP_ID).and_then(|g| g.get_profile(profile_id));
    }

    pub fn get_groups(&self) -> &LinkedList<MdxProfile> {
        &self.mdx_groups
    }

    /// 获取组（向后兼容）
    pub fn get_group(&self, group_id: ProfileId) -> Option<&MdxProfile> {
        self.find_profile(group_id).filter(|p| p.is_group())
    }

    /// 获取可变组（向后兼容）
    pub fn get_group_mut(&mut self, group_id: ProfileId) -> Option<&mut MdxProfile> {
        // 直接在顶级groups中查找，避免调用find_profile_mut造成递归
        self.mdx_groups.iter_mut().find(|p| p.profile_id == group_id && p.is_group())
    }

    /// 获取配置文件（在指定group中查找）
    pub fn get_profile(&self, parent_group_id: ProfileId, profile_id: ProfileId) -> Option<&MdxProfile> {
        self.get_group(parent_group_id)?.get_profile(profile_id)
    }

    /// 创建新组
    pub fn create_group(&mut self, title: String) -> MdxProfile {
        let mut new_group = MdxProfile::new_group(title, self.get_next_profile_id());
        new_group.options = self.default_mdx_options.clone();
        if let Some(default_group) = self.get_group(DEFAULT_GROUP_ID) {
            if let Some(profiles) = &default_group.profiles {
                new_group.profiles = Some(profiles.clone());
            }
        }
        self.replace_group_profile(&new_group);
        new_group
    }

    /// 移除profile或group
    pub fn remove_profile(&mut self, profile_id: ProfileId) -> bool {
        // 尝试从顶级groups中移除
        let original_len = self.mdx_groups.len();
        let mut new_groups = LinkedList::new();
        while let Some(group) = self.mdx_groups.pop_front() {
            if group.profile_id != profile_id {
                new_groups.push_back(group);
            }
        }
        self.mdx_groups = new_groups;
        
        if self.mdx_groups.len() != original_len {
            return true;
        }
        
        // 如果没在顶级找到，在各group的子profiles中查找
        for group in &mut self.mdx_groups {
            if let Some(profiles) = &mut group.profiles {
                let original_len = profiles.len();
                let mut new_profiles = LinkedList::new();
                while let Some(profile) = profiles.pop_front() {
                    if profile.profile_id != profile_id {
                        new_profiles.push_back(profile);
                    }
                }
                *profiles = new_profiles;
                if profiles.len() != original_len {
                    return true;
                }
            }
        }
        false
    }

    /// 移除组（向后兼容）
    pub fn remove_group(&mut self, group_id: ProfileId) -> bool {
        self.remove_profile(group_id)
    }

    pub fn adjust_profile_order(&mut self, parent_group_id: ProfileId, profile_id: ProfileId, new_index: usize) {
        if let Some(group) = self.get_group_mut(parent_group_id) {
            group.adjust_profile_order(profile_id, new_index);
        }
    }

    /// 调整组的顺序
    pub fn adjust_group_order(&mut self, group_id: ProfileId, new_index: usize) {
        // 找到要移动的组
        let mut target_group = None;
        let mut new_groups = LinkedList::new();
        
        // 先移除目标组
        while let Some(group) = self.mdx_groups.pop_front() {
            if group.profile_id == group_id {
                target_group = Some(group);
            } else {
                new_groups.push_back(group);
            }
        }
        
        // 如果找到了目标组，将其插入到新位置
        if let Some(group) = target_group {
            let mut final_groups = LinkedList::new();
            let mut current_index = 0;
            
            // 先添加新位置之前的组
            while let Some(g) = new_groups.pop_front() {
                if current_index == new_index {
                    final_groups.push_back(group.clone());
                }
                final_groups.push_back(g);
                current_index += 1;
            }
            
            // 如果新位置在最后，添加目标组
            if current_index <= new_index {
                final_groups.push_back(group);
            }
            
            self.mdx_groups = final_groups;
        } else {
            // 如果没找到目标组，恢复原状态
            self.mdx_groups = new_groups;
        }
    }
    
    // Replace the existing group profile with the same profile_id, or add a new one if not found.
    pub fn replace_group_profile(&mut self, group_profile: &MdxProfile) {
        let profile_id = group_profile.profile_id;
        
        if let Some(existing_profile) = self.mdx_groups.iter_mut().find(|p| p.profile_id == profile_id) {
            *existing_profile = group_profile.clone();
        } else {
            self.mdx_groups.push_back(group_profile.clone());
        }                
    }

    // scan the directory url to find all "*.mdx" files recursively
    // create a new mdx_group with profile_id is DEFAULT_GROUP_ID, and generate every mdx file into a MdxProfile, and add it to this mdx_group object
    pub fn scan_dir(&self, dir_url: &Url) -> std::result::Result<MdxProfile, ZdbError> {
        let mut mdx_group = MdxProfile::new_group("Scanned".to_string(), DEFAULT_GROUP_ID);
        // Match .mdx files (case-insensitive) that don't start with a dot
        let pattern = Regex::new(r"(?i)^[^.].*\.mdx$").map_err(|e| ZdbError::invalid_parameter(format!("Regex pattern error: {}", e)))?;
        let mut files = LinkedList::<PathBuf>::new();
        let target_path = get_decoded_path(dir_url)?;
        log::info!("scan_dir: {:?}", target_path);
        scan_dir(&target_path, &pattern, true, &mut files)?;

        let base_url= dir_url.clone();
        let mut temp_id = 1000; // Use temporary IDs for scanning, will be replaced during merge
        for file_path in files {
            let mdx_file_url = replace_url_path(&base_url, &file_path)?;
            let mut mdx_profile= MdxProfile::new(mdx_file_url.to_string(), mdx_profile::INVALID_PROFILE_ID, false);
            mdx_profile.options = self.default_mdx_options.clone();
            mdx_group.replace_profile(&mdx_profile, temp_id);
            temp_id += 1;
        }
        Ok(mdx_group)
    }
    /// 扫描词典目录并更新MDX管理器
    pub fn scan_directories(&self, search_paths: &[String]) -> Result<MdxProfile> {
        let mut mdx_group = MdxProfile::new_group("Scanned Directories".to_string(), DEFAULT_GROUP_ID);
        for search_path in search_paths {
            let url = Url::from_file_path(search_path)
                .map_err(|_| ZdbError::invalid_parameter(format!("无效的目录路径: {}", search_path)))?;
            let new_group = self.scan_dir(&url)?;
            if let Some(new_profiles) = new_group.profiles {
                if mdx_group.profiles.is_none() {
                    mdx_group.profiles = Some(LinkedList::new());
                }
                mdx_group.profiles.as_mut().unwrap().extend(new_profiles);
            }
        }
        Ok(mdx_group)
    }

    /// Merge profiles from source_group into target_group by URL
    /// Keeps profiles that exist in source_group, adds new ones, and removes profiles not in source_group
    /// 
    /// # Arguments
    /// * `target_group` - The group to merge into
    /// * `source_group` - The group to merge from
    /// * `next_id` - Starting ID for new profiles, will be incremented for each new profile added
    fn merge_profiles_by_url(&self, target_group: &mut MdxProfile, source_group: &MdxProfile, next_id: &mut ProfileId) {
        if let Some(source_profiles) = &source_group.profiles {
            if target_group.profiles.is_none() {
                target_group.profiles = Some(LinkedList::new());
            }
            
            let mut new_merged_profiles = LinkedList::new();
            let current_profiles = target_group.profiles.as_ref().unwrap();
            
            // Iterate through source_group's profiles to build the new merged list
            for source_profile in source_profiles.iter() {
                // Check if this profile exists in current profiles
                if let Some(existing_profile) = current_profiles.iter().find(|p| p.url == source_profile.url) {
                    // Keep the existing profile (preserve its profile_id and other settings)
                    new_merged_profiles.push_back(existing_profile.clone());
                } else {
                    // Add new profile from source_group with a globally unique profile_id
                    let mut new_profile = source_profile.clone();
                    new_profile.profile_id = *next_id;
                    *next_id += 1; // Increment for next new profile
                    new_merged_profiles.push_back(new_profile);
                }
            }
            
            // Replace the current profiles with the merged list
            target_group.profiles = Some(new_merged_profiles);
        } else {
            // If source_group has no profiles, clear all profiles from target_group
            target_group.profiles = Some(LinkedList::new());
        }
    }

    pub fn refresh_library(&mut self, search_paths:&[String])->Result<()> {
        let new_group = self.scan_directories(search_paths)?;
        
        // Get the next available ID before we start modifying groups
        let mut next_id = self.get_next_profile_id();
        
        // Clone the groups to avoid borrow checker issues
        let mut updated_groups = LinkedList::new();
        while let Some(mut group) = self.mdx_groups.pop_front() {
            log::info!("group id: {}, title: {}", group.profile_id, group.title);
            self.merge_profiles_by_url(&mut group, &new_group, &mut next_id);
            updated_groups.push_back(group);
        }
        self.mdx_groups = updated_groups;

        for profile in self.mdx_groups.front().unwrap().profiles.as_ref().unwrap().iter() {
            log::info!("profile id: {}, title: {}", profile.profile_id, profile.title);
        }
        Ok(())
    }

    pub fn from_file<P:AsRef<Path>>(file_path: P) -> std::result::Result<Self, ZdbError> {
        let mut manager = if file_path.as_ref().exists() {
            let json = std::fs::read_to_string(&file_path)?;
            if !json.is_empty() {
                Self::from_json(&json)?
            } else {
                Self::new()
            }
        }else{
            Self::new()
        };
        
        // Ensure the default group exists regardless of how the manager was created
        manager.ensure_default_group();
        manager.library_file_path = file_path.as_ref().to_string_lossy().to_string();
        Ok(manager)
    }

    pub fn save_library(&self) -> Result<()> {
        self.to_file(&self.library_file_path)?;
        Ok(())
    }
    
    pub fn to_file<P:AsRef<Path>>(&self, file_path: P) -> std::result::Result<(), ZdbError> {
        let json = self.to_json()?;
        std::fs::write(file_path, json)?;
        Ok(())
    }

    pub fn from_json(json: &str) -> std::result::Result<Self, ZdbError> {
        let mdx_groups: LinkedList<MdxProfile> = serde_json::from_str(json)?;
        let mut manager = Self { 
            mdx_groups,
            default_mdx_options: MdxOptions::default(),
            library_file_path: String::new(),
            icon_cache: HashMap::new(),
        };
        
        // Ensure the default "All" group exists
        manager.ensure_default_group();
        
        Ok(manager)
    }

    pub fn to_json(&self) -> std::result::Result<String, ZdbError> {
        let json = serde_json::to_string(&self.mdx_groups)?;
        Ok(json)
    }

    pub fn get_icon_for_profile(&mut self, profile_id: ProfileId) -> Result<Option<(Vec<u8>, String)>> {
        let profile = self.find_profile(profile_id).ok_or_else(|| ZdbError::invalid_parameter(format!("Profile {} not found", profile_id)))?;
        let icon_data = self.icon_cache.get(&profile_id);
        if icon_data.is_none() {
            let data = load_logo_for_profile(profile)?;
            if !data.0.is_empty() {
                self.icon_cache.insert(profile_id, data.clone());
            }
            return Ok(Some(data.clone()));
        }
        Ok(None)
    }
}

impl Default for LibraryManager {
    fn default() -> Self {
        Self::new()
    }
}

fn load_logo_for_profile(profile: &MdxProfile) -> Result<(Vec<u8>, String)> {
    const LOGO_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "bmp", "tiff", "ico", "webp"];
    
    // First try to load logo from the same directory as the MDX file
    let db_url = Url::parse(&profile.url)?;
    // Fallback: try to find DictIcon.* in the root
    for &ext in LOGO_EXTENSIONS {
        // Build a resource url path like file:///DictIcon.png
        let logo_url = with_extension(&db_url, ext)?;
        let logo_path = logo_url.to_file_path().map_err(|_| ZdbError::invalid_parameter(format!("Invalid logo url: {}", &logo_url)))?;
        if logo_path.is_file() && logo_path.exists() {
            let logo_bytes=std::fs::read(logo_path)?;
            return Ok((logo_bytes, MimeGuess::from_ext(ext).first_or_octet_stream().to_string()));
        }
    }    
    Ok((Vec::new(), String::new()))
}