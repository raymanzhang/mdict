use std::path::Path;
use std::sync::{RwLock, Arc, Mutex};
use std::collections::{HashMap, LinkedList};
use once_cell::sync::OnceCell;
use rusqlite::Connection;
use tauri::{Manager, path::BaseDirectory, Emitter};

use mdx::storage::EntryNo;
use mdx::utils::fix_windows_path_buf;

use crate::app_config::{AppConfig, ConfigSection, ConfigKey};
use crate::error::{Result, ZdbError};
use crate::favorites::FavoritesManager;
use crate::history::HistoryManager;
use crate::library_mgr::LibraryManager;
use crate::mdx_db::{MdxIndex, MdxDb};
use crate::mdx_db_group::{MdxDbGroup, MdxGroupIndex};
use crate::mdx_profile::{ProfileId, DEFAULT_GROUP_ID, INVALID_PROFILE_ID, MdxProfile};
use crate::utils::log_if_err;
pub enum DbType {
    MdxDb(MdxDb),
    MdxDbGroup(MdxDbGroup),
}

/// MDict应用全局单例结构体
/// 参考libmdx中的MDictApp实现
pub struct MdictApp {
    /// 应用配置
    pub config: AppConfig,
    /// 库管理器
    pub library_manager: LibraryManager,
    /// 统一数据库连接池 (shared by history and favorites managers)
    /// Kept for managing database connection lifecycle
    #[allow(dead_code)]
    db_connection: Arc<Mutex<Connection>>,
    /// 历史记录管理器
    pub history_manager: HistoryManager,
    /// 收藏管理器
    pub favorites_manager: FavoritesManager,
    /// 主数据库
    pub main_db: Option<DbType>,

    /// Tauri app handle for emitting events
    app_handle: tauri::AppHandle,

    /// 程序数据根目录
    data_home_dir: String,
    /// 文档目录
    _doc_dir: String,
    /// 资源目录
    _res_dir: String,
    /// 字体目录
    _font_dir: String,
    /// 音频库目录
    _audio_lib_dir: String,
    /// 临时文件目录
    tmp_dir: String,

    /// 库搜索路径列表
    lib_search_paths: Vec<String>,

    /// Cached search results for group mode (normalized_key, display_key, group_indexes)
    group_search_results: LinkedList<(String, String, LinkedList<MdxGroupIndex>)>,
    /// Asset files loaded into memory (filename -> content)
    assets: HashMap<String, Vec<u8>>,

    base_url: String,

}

// SAFETY: MdictApp is protected by RwLock, and we ensure single-threaded access to MDX readers
unsafe impl Send for MdictApp {}
unsafe impl Sync for MdictApp {}

impl MdictApp {

    /// 使用主目录初始化应用
    pub fn init_app_with_home_dir<P: AsRef<Path>>(
        data_home_dir: P, 
        extra_search_paths: Vec<String>,
        app_handle: &tauri::AppHandle
    ) -> Result<Self> {

        let home_dir = fix_windows_path_buf(data_home_dir.as_ref().to_path_buf()).to_string_lossy().into_owned();
        log::info!("init_app_with_home_dir: {:?}", home_dir);        
        let doc_dir = format!("{}/doc", home_dir);
        let audio_lib_dir = format!("{}/audiolib", home_dir);
        let font_dir = format!("{}/fonts", home_dir);
        let res_dir = format!("{}/res", home_dir);
        let tmp_dir = format!("{}/tmp", home_dir);
        
        Self::init_app(home_dir, doc_dir, audio_lib_dir, font_dir, res_dir, tmp_dir, extra_search_paths, app_handle)
    }

    /// 初始化应用
    pub fn init_app(
        data_home_dir: String,
        doc_dir: String,
        audio_lib_dir: String,
        font_dir: String,
        res_dir: String,
        tmp_dir: String,
        extra_search_paths: Vec<String>,
        app_handle: &tauri::AppHandle,
    ) -> Result<Self> {
        let data_home_dir = Self::normalize_dir_path(data_home_dir);
        let doc_dir = Self::normalize_dir_path(doc_dir);
        let audio_lib_dir = Self::normalize_dir_path(audio_lib_dir);
        let font_dir = Self::normalize_dir_path(font_dir);
        let res_dir = Self::normalize_dir_path(res_dir);
        let tmp_dir = Self::normalize_dir_path(tmp_dir);
        
        // 默认添加doc目录到搜索路径
        let mut lib_search_paths = Vec::new();
        lib_search_paths.push(doc_dir.clone());        
        lib_search_paths.extend(extra_search_paths);
        
        let dirs = [
            &doc_dir,
            &tmp_dir,
            &audio_lib_dir,
            &font_dir,
        ];
        // 创建必要的目录
        Self::create_directories(&dirs)?;
        
        // 清理临时文件
        Self::cleanup_tmp(&tmp_dir)?;
        
        let config_file_path = doc_dir.clone() + "/config.json";
        let config = AppConfig::new(&config_file_path)?;

        // 加载词典列表
        let extra_library_path = config.get_config_with_default(ConfigSection::Global, ConfigKey::ExtraLibSearchPath, String::new());
        if !extra_library_path.is_empty() {
            lib_search_paths.push(extra_library_path);
        }
        let library_file_path = doc_dir.clone() + "/library.json";
        let mut library_manager = LibraryManager::from_file(&library_file_path)?;
        
        // 自动扫描词典目录变化
        library_manager.refresh_library(&lib_search_paths)?;
        library_manager.save_library()?;
        
        // Initialize unified database connection with mdict.db
        let mdict_db_path = format!("{}mdict.db", doc_dir);
        let conn = Connection::open(&mdict_db_path)
            .map_err(|e| ZdbError::invalid_data_format(format!("Failed to open database: {}", e)))?;
        
        // Enable WAL mode for better concurrent access (ignore error for compatibility)
        let _ = conn.query_row("PRAGMA journal_mode=WAL", [], |_| Ok(()));
        
        // Set busy timeout to handle lock contention
        let _ = conn.query_row("PRAGMA busy_timeout=5000", [], |_| Ok(()));
        
        let db_connection = Arc::new(Mutex::new(conn));
        
        // Initialize history and favorites managers with shared connection
        let history_manager = HistoryManager::new(db_connection.clone())?;
        let favorites_manager = FavoritesManager::new(db_connection.clone())?;
        
        let mut app = Self {
            config,
            library_manager,
            db_connection,
            history_manager,
            favorites_manager,
            data_home_dir,
            _doc_dir: doc_dir,
            tmp_dir,
            _res_dir: res_dir,
            _font_dir: font_dir,
            _audio_lib_dir: audio_lib_dir,
            lib_search_paths,
            main_db: None,
            group_search_results: LinkedList::new(),
            assets: HashMap::new(),
            app_handle: app_handle.clone(),
            base_url: "mdx://mdict.cn/service/".to_string(),
        };

        // Load asset files into memory
        app.load_assets(app_handle)?;

        // Auto-open last used profile or default group
        log_if_err(&app.auto_open_startup_profile());
        Ok(app)
    }

    /// 规范化目录路径，确保以/结尾
    fn normalize_dir_path(mut path: String) -> String {
        if !path.is_empty() && !path.ends_with('/') && !path.ends_with('\\') {
            path.push('/');
        }
        path
    }

    /// 创建必要的目录
    fn create_directories(dirs: &[&String]) -> Result<()> {        
        for dir in dirs.iter() {
            if !dir.is_empty() && !std::path::Path::new(dir).exists() {
                std::fs::create_dir_all(dir)?;
            }
        }
        
        Ok(())
    }

    /// 清理临时文件
    fn cleanup_tmp(tmp_dir: &String) -> Result<()> {
        if !tmp_dir.is_empty() && std::path::Path::new(&tmp_dir).exists() {
            if let Ok(entries) = std::fs::read_dir(&tmp_dir) {
                for entry in entries.flatten() {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
        Ok(())
    }

    /// 加载assets目录下的文件到内存
    fn load_assets(&mut self, app_handle: &tauri::AppHandle) -> Result<()> {
        // 使用tauri的路径解析来获取assets目录
        let assets_dir = match app_handle.path().resolve("assets", BaseDirectory::Resource) {
            Ok(path) => path,
            Err(_) => {
                // 如果无法解析resource目录，回退到传统方法
                let fallback_dir = if let Ok(exe_path) = std::env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        exe_dir.join("assets")
                    } else {
                        std::path::PathBuf::from("assets")
                    }
                } else {
                    std::path::PathBuf::from("assets")
                };
                
                // 如果回退目录也不存在，尝试开发环境路径
                if !fallback_dir.exists() {
                    let dev_assets_dir = std::path::PathBuf::from("src-tauri/assets");
                    if dev_assets_dir.exists() {
                        dev_assets_dir
                    } else {
                        return Err(ZdbError::invalid_parameter(format!("Assets directory not found: {:?}", fallback_dir)));
                    }
                } else {
                    fallback_dir
                }
            }
        };

        // 确保assets目录存在
        if assets_dir.exists() {
            // 递归读取目录下的所有文件
            self.load_assets_recursive(&assets_dir, &assets_dir)?;
            log::info!("Loaded {} assets from {:?}", self.assets.len(), assets_dir);
        }else{
            log::warn!("Assets directory not found: {:?}", assets_dir);
        }
        Ok(())
    }

    /// 递归加载assets目录下的文件
    fn load_assets_recursive(&mut self, current_dir: &std::path::Path, assets_root: &std::path::Path) -> Result<()> {
        let entries = std::fs::read_dir(current_dir)?;

        for entry in entries {
            let entry = entry?;
            let file_path = entry.path();
            
            if file_path.is_file() {
                // 计算相对于assets根目录的路径
                let relative_path = file_path.strip_prefix(assets_root)
                    .map_err(|_| ZdbError::invalid_parameter(format!("无法计算相对路径: {:?}", file_path)))?;
                
                match std::fs::read(&file_path) {
                    Ok(content) => {
                        // 使用包含完整相对路径的key格式，例如"/subdir/file.html"
                        let asset_key = format!("/{}", relative_path.to_string_lossy().replace('\\', "/"));
                        self.assets.insert(asset_key.clone(), content);
                        log::info!("Loaded asset: {} ({} bytes)", asset_key, self.assets.get(&asset_key).unwrap().len());
                    }
                    Err(e) => {
                        log::warn!("Failed to load asset {:?}: {}", relative_path, e);
                    }
                }
            } else if file_path.is_dir() {
                // 递归处理子目录
                self.load_assets_recursive(&file_path, assets_root)?;
            }
        }
        
        Ok(())
    }

    pub fn open_main_db(&mut self, profile_id: ProfileId) -> Result<()> {
        self.main_db = None;
        // Clear cached search results when switching databases
        self.group_search_results.clear();
        if profile_id != INVALID_PROFILE_ID {
            let profile = self.library_manager.find_profile(profile_id).ok_or_else(|| ZdbError::invalid_parameter(format!("Profile {} not found", profile_id)))?;
            if profile.is_group() {
                let db = MdxDbGroup::new(&profile, &self.data_home_dir).map_err(|e| ZdbError::invalid_data_format(format!("Failed to open group database: {}: {}", profile_id, e)))?;
                self.main_db = Some(DbType::MdxDbGroup(db));
            } else {
                let db = MdxDb::new(&profile, &self.data_home_dir).map_err(|e| ZdbError::invalid_data_format(format!("Failed to open database: {}: {}", profile_id, e)))?;
                self.main_db = Some(DbType::MdxDb(db));
            }
        }else{
            return Err(ZdbError::invalid_parameter(format!("Invalid profile ID: {}", profile_id)));
        }
        // Update last_main_profile_id in config
        self.config.set_config(ConfigSection::Global, ConfigKey::LastMainProfileId, profile_id)?;
        self.config.save()?;
        
        Ok(())
    }

    /// Search for words in group mode and cache results
    pub fn incremental_search(&mut self, query: &str, max_results_per_lib: usize) -> Result<Option<(EntryNo, usize)>> {
        // Clear cached grouped results for fresh incremental search
        self.group_search_results.clear();
        if let Some(DbType::MdxDb(ref mut db)) = self.main_db {
            // Find best matching entry
            if let Some(best_match) = db.find_index(query, true, true, true)? {
                // Get a list of entries starting from the best match
                let start_entry = best_match.key_index.entry_no;
                Ok(Some((start_entry, db.get_entry_count() as usize)))
            } else {
                Ok(None)
            }
        } else if let Some(DbType::MdxDbGroup(ref mut group_db)) = self.main_db {
            // Delegate grouped search to MdxDbGroup and cache results
            let cached_results = group_db.find_best_match_indexes(query, max_results_per_lib)?;
            self.group_search_results = cached_results;
            if self.group_search_results.is_empty() {
                Ok(None)
            } else {
                Ok(Some((0, self.group_search_results.len())))
            }
        } else {
            Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }
    }

    /// Perform full-text search and cache grouped results
    /// Returns total result count
    pub fn fulltext_search(&mut self, query: &str, max_results_per_lib: usize) -> Result<usize> {
        // Reset previous cached results
        self.group_search_results.clear();

        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                let mut group_results : LinkedList<(String, String, LinkedList<MdxGroupIndex>)> = LinkedList::new();
                let results = db.fulltext_find(query, max_results_per_lib)?;
                for (_score, index) in results.into_iter() {
                    let mut group_index=MdxGroupIndex {
                        profile_id: index.profile_id,
                        primary_key: index.key_index.key.clone(),
                        indexes: LinkedList::new(),
                    };
                    group_index.indexes.push_back(index.clone());
                    let mut group_indexes = LinkedList::new();
                    group_indexes.push_back(group_index);
                    group_results.push_back((MdxDb::normalize_keyword(&index.key_index.key), index.key_index.key.clone(), group_indexes));
                }

                self.group_search_results = group_results;
                Ok(self.group_search_results.len())
            }
            Some(DbType::MdxDbGroup(group_db)) => {
                // Group dictionary mode: delegate to group's fulltext_find
                let results = group_db.fulltext_find(query, max_results_per_lib)?;
                self.group_search_results = results;
                Ok(self.group_search_results.len())
            }
            None => Err(ZdbError::invalid_parameter("No database opened".to_string())),
        }
    }

    /// Get HTML content for a single entry
    pub fn get_entry_html_by_index(&mut self, index:&MdxIndex) -> Result<String> {
        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                let index = db.get_index(index.key_index.entry_no)?;
                return db.get_html(&index, &self.base_url);
            }
            Some(DbType::MdxDbGroup(group_db)) => {
                if let Some(mdx_db) = group_db.mdx_dbs.get_mut(&index.profile_id) {
                    let index = mdx_db.get_index(index.key_index.entry_no)?;
                    return mdx_db.get_html(&index, &self.base_url);
                } else {
                    return Err(ZdbError::invalid_parameter(format!("Library with profile_id {} not found in group", index.profile_id)));
                }
            }
            None => return Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }
    }

    /// Get binary data from MDD file, returns (data, mime_type)
    pub fn get_mdd_data(&mut self, profile_id: &ProfileId, file_path: &str) -> Result<Option<(Vec<u8>, String)>> {
        if file_path=="/$MdxDictIcon" {
            return self.library_manager.get_icon_for_profile(*profile_id);
        }
        
        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                if db.profile.profile_id != *profile_id {
                    Err(ZdbError::invalid_parameter(format!("Library id not match {}", profile_id)))
                } else {
                    db.get_data(file_path)
                }
            }
            Some(DbType::MdxDbGroup(group_db)) => {
                if let Some(mdx_db) = group_db.mdx_dbs.get_mut(&profile_id) {
                    mdx_db.get_data(file_path)
                } else {
                    Err(ZdbError::invalid_parameter(format!("Library with profile_id {} not found in group", profile_id)))
                }
            }
            None => Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }
    }

    // NOTE: is_single_library_mode and is_group_mode methods have been moved to lib.rs
    // and are now computed from main_db_profile instead of being implemented here

    /// Auto-open profile on startup based on configuration
    fn auto_open_startup_profile(&mut self) -> Result<()> {
        // Get last_main_profile_id from config
        let mut last_profile_id: ProfileId = self.config.get_config_with_default(
            ConfigSection::Global, 
            ConfigKey::LastMainProfileId, 
            INVALID_PROFILE_ID
        );

        if last_profile_id == INVALID_PROFILE_ID  {
            last_profile_id = DEFAULT_GROUP_ID;
        }
        let profile= self.library_manager.find_profile(last_profile_id);
        if profile.is_some() {
            let profile= profile.unwrap(); 
            if profile.is_group() && (profile.get_profiles().is_none() || profile.get_profiles().unwrap().is_empty()) {
                last_profile_id = INVALID_PROFILE_ID;
            }
        }else{
            last_profile_id = INVALID_PROFILE_ID;
        }
        
        if last_profile_id != INVALID_PROFILE_ID {
            self.open_main_db(last_profile_id)?;
        }
        Ok(())
    }

    /// 结束应用
    pub fn term_app(&mut self) -> Result<()> {
        // 保存所有配置
        self.config.save()?;
        
        // 保存词典列表
        let library_path = self.config.get_config_with_default(ConfigSection::Global, ConfigKey::ExtraLibSearchPath, String::new());
        self.library_manager.to_file(&library_path)?;
        
        // 清理临时文件
        Self::cleanup_tmp(&self.tmp_dir)?;
        
        Ok(())
    }

    /// 获取base URL
    pub fn get_base_url(&self) -> &str {
        &self.base_url
    }

    /// 设置base URL
    pub fn set_base_url(&mut self, base_url: String) -> Result<()> {
        log::info!("Setting base URL: {}", base_url);
        self.base_url = base_url;
        Ok(())
    }

    /// 获取库搜索路径
    pub fn get_lib_search_paths(&self) -> Result<&[String]> {
        Ok(&self.lib_search_paths)
    }

    /// 添加库搜索路径
    pub fn add_lib_search_path(&mut self, path: String) -> Result<()> {
        self.lib_search_paths.push(path);
        Ok(())
    }

    /// 清空库搜索路径
    pub fn clear_lib_search_paths(&mut self) -> Result<()> {
        self.lib_search_paths.clear();
        Ok(())
    }

    /// 获取asset文件内容（二进制）
    pub fn get_asset(&self, filename: &str) -> Result<Option<&Vec<u8>>> {
        Ok(self.assets.get(filename))
    }

    /// 获取asset文件内容（文本）
    pub fn get_asset_text(&self, filename: &str) -> Result<Option<String>> {
        Ok(self.assets.get(filename).and_then(|bytes| String::from_utf8(bytes.clone()).ok()))
    }

    /// 获取当前主数据库的profile_id，如果没有则返回INVALID_PROFILE_ID
    pub fn get_current_main_profile_id(&self) -> Result<ProfileId> {
        Ok(match &self.main_db {
            Some(DbType::MdxDb(db)) => db.profile.profile_id,
            Some(DbType::MdxDbGroup(db)) => db.profile.profile_id,
            None => INVALID_PROFILE_ID,
        })
    }

    /// 获取当前主数据库的profile对象
    pub fn get_current_main_profile(&self) -> Result<Option<MdxProfile>> {
        Ok(match &self.main_db {
            Some(DbType::MdxDb(db)) => Some(db.profile.clone()),
            Some(DbType::MdxDbGroup(db)) => Some(db.profile.clone()),
            None => None,
        })
    }

    pub fn get_content_url(&self, index_no: usize) -> Result<String> {
        if let Some(DbType::MdxDb(db)) = &self.main_db {
            Ok(format!("{}entryx?profile_id={}&entry_no={}", self.base_url, db.profile.profile_id, index_no ))
        } else if let Some(DbType::MdxDbGroup(_group_db)) = &self.main_db {
            Ok(format!("{}union?index_no={}", self.base_url, index_no))
        } else {
            Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }
    }

    /// Get the total entry count for the current database
    pub fn get_entry_count(&self) -> Result<usize> {
        // Prefer cached grouped results if available (e.g., full-text/group searches)
        if !self.group_search_results.is_empty() {
            return Ok(self.group_search_results.len());
        }

        match &self.main_db {
            Some(DbType::MdxDb(db)) => {
                Ok(db.get_entry_count() as usize)
            }
            Some(DbType::MdxDbGroup(_group_db)) => {
                // For group mode, return the count of cached search results
                Ok(self.group_search_results.len())
            }
            None => Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }
    }

    /// Find the best matching entry index for a given key
    /// Returns LinkedList<MdxGroupIndex> where:
    /// - Single dictionary mode: returns single MdxGroupIndex with one result
    /// - Group mode: returns MdxGroupIndex entries grouped by profile_id
    pub fn find_index(&mut self, key: &str) -> Result<LinkedList<MdxGroupIndex>> {
        let mut result = LinkedList::new();
        
        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                // Single dictionary mode: wrap MdxIndex in MdxGroupIndex and put in LinkedList
                if let Some(mdx_index) = db.find_index(key, false, false, true)? {
                        let mut group_index = MdxGroupIndex::default();
                        group_index.profile_id = db.profile.profile_id;
                        group_index.primary_key = key.to_string();
                        group_index.indexes = LinkedList::new();
                        group_index.indexes.push_back(mdx_index);
                        result.push_back(group_index);
                }
                Ok(result)
            }
            Some(DbType::MdxDbGroup(group_db)) => {
                // Group mode: search across all dictionaries and group by profile_id
                let mut profile_groups = std::collections::HashMap::<ProfileId, MdxGroupIndex>::new();
                
                for mdx_db in group_db.mdx_dbs.values_mut() {
                    if let Some(mdx_index) = mdx_db.find_index(key, false,   false, true)? {
                        let profile_id = mdx_index.profile_id;
                        
                        // Get or create MdxGroupIndex for this profile_id
                        let group_index = profile_groups.entry(profile_id).or_insert_with(|| {
                            MdxGroupIndex {
                                profile_id,
                                primary_key: key.to_string(),
                                indexes: LinkedList::new(),
                            }
                        });
                        
                        // Add the found index to this profile's group
                        group_index.indexes.push_back(mdx_index);
                    }
                }
                
                // Convert HashMap to LinkedList, sorted by profile order
                if let Some(profiles) = group_db.profile.get_profiles() {
                    for profile in profiles.iter() {
                        if let Some(group_index) = profile_groups.remove(&profile.profile_id) {
                            result.push_back(group_index);
                        }
                    }
                }
                
                Ok(result)
            }
            None => Ok(result),
        }
    }


    /// Get entries starting from a specific index
    /// Unified method that works for both single dictionary and group modes
    /// Returns Vec of (keyword, entry_count)
    pub fn get_result_key_list(&mut self, start_index: i64, max_count: usize) -> Result<LinkedList<(String, usize)>> {
        // If we have cached grouped results (e.g., from full-text or grouped search), use them regardless of mode
        if !self.group_search_results.is_empty() {
            if start_index >= self.group_search_results.len() as i64 {
                return Err(ZdbError::invalid_parameter(format!("Start index out of range: {} >= {}", start_index, self.group_search_results.len())));
            }
            let mut results = LinkedList::new();
            for (_, display_key, group_indexes) in self.group_search_results.iter().skip(start_index as usize) {
                // Entry count equals number of dictionaries (profile groups) contributing to this key
                let group_count = group_indexes.len();
                results.push_back((display_key.clone(), group_count));
                if results.len() >= max_count {
                    break;
                }
            }
            return Ok(results);
        }

        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                // Single dictionary mode: get entries directly from the dictionary
                let indexes = db.get_indexes(start_index, max_count as u64)?;
                let mut results = LinkedList::new();
                for index in indexes {
                    let keyword = index.key_index.key.clone();
                    // For single dictionary mode, group count is always 1
                    results.push_back((keyword, 1));
                }
                Ok(results)
            }
            Some(DbType::MdxDbGroup(_group_db)) => {
                // Group mode: get entries from cached search results
                // If we reached here, it means we have no cached grouped results
                return Ok(LinkedList::new());  
            }
            None => Err(ZdbError::invalid_parameter("No database opened".to_string())),
        }
    }

    /// Navigate to a URL by emitting an event to the frontend
    pub fn navigate_to(&self, url: &str) -> Result<()> {
        log::info!("Navigating to URL: {}", url);
        self.app_handle.emit("navigate_to", url).map_err(|e| ZdbError::invalid_data_format(format!("Failed to emit navigate_to event: {}", e)))?;
        Ok(())
    }

    /// Reload resources (assets and HTML templates)
    pub fn reload_resources(&mut self) -> Result<()> {
        log::info!("Reloading resources...");
        
        // Clear existing assets and templates
        self.assets.clear();
        
        // Reload assets
        self.load_assets(&self.app_handle.clone())?;        
        log::info!("Resources reloaded successfully. {} assets", self.assets.len());
        Ok(())
    }

    /// Get indexes for a specific entry position, returning grouped data
    /// Returns LinkedList<MdxGroupIndex>
    pub fn get_group_indexes(&mut self, index_no: usize) -> Result<LinkedList<MdxGroupIndex>> {        
        // If we have cached grouped results, return from cache regardless of mode
        if !self.group_search_results.is_empty() {
            if index_no >= self.group_search_results.len() {
                return Err(ZdbError::invalid_parameter(format!("Index out of range: {} >= {}", index_no, self.group_search_results.len())));
            }
            return Ok(self.group_search_results.iter().nth(index_no).unwrap().2.clone());
        }

        match &mut self.main_db {
            Some(DbType::MdxDb(db)) => {
                // Single dictionary mode: return one MdxGroupIndex with single index
                if index_no >= db.get_entry_count() as usize {
                    return Err(ZdbError::invalid_parameter(format!("Index out of range: {} >= {}", index_no, db.get_entry_count() as usize)));
                }
                
                let mdx_index = db.get_index(index_no as i64)?;
                let mut indexes = LinkedList::new();
                indexes.push_back(mdx_index.clone());
                
                let group_index = MdxGroupIndex {
                    profile_id: db.profile.profile_id,
                    primary_key: mdx_index.key_index.key.clone(),
                    indexes,
                };
                let mut result = LinkedList::new();
                result.push_back(group_index);
                return Ok(result);
            }
            Some(DbType::MdxDbGroup(_group_db)) => {
                // Group mode without cache
                return Err(ZdbError::invalid_parameter("No grouped search results available".to_string()));
            }
            None => return Err(ZdbError::invalid_parameter("No database opened".to_string()))
        }        
    }
}

/// 全局MdictApp实例
static GLOBAL_MDICT_APP: OnceCell<RwLock<MdictApp>> = OnceCell::new();

/// 初始化全局MdictApp
pub fn init_mdict_app<P: AsRef<Path>>(app_home_dir: P, extra_search_paths: Vec<String>, app_handle: &tauri::AppHandle) -> Result<()> {
    let app = MdictApp::init_app_with_home_dir( app_home_dir, extra_search_paths, app_handle)?;
    let app_lock = RwLock::new(app);
    
    GLOBAL_MDICT_APP.set(app_lock)
        .map_err(|_| ZdbError::invalid_parameter("全局MdictApp已经初始化".to_string()))?;
    
    Ok(())
}

/// 获取全局MdictApp
fn get_mdict_app() -> Result<&'static RwLock<MdictApp>> {
    GLOBAL_MDICT_APP.get()
        .ok_or_else(|| ZdbError::invalid_parameter("全局MdictApp尚未初始化".to_string()))
}

fn mdict_app() -> Result<&'static RwLock<MdictApp>> {
    get_mdict_app()
}

/// 简化的模板方法：统一处理读操作的访问模式
pub fn with_read_access<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&MdictApp) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let app = app_lock.read()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp读锁".to_string()))?;
    operation(&app)
}

/// 简化的模板方法：统一处理写操作的访问模式
pub fn with_write_access<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&mut MdictApp) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let mut app = app_lock.write()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp写锁".to_string()))?;
    operation(&mut app)
}

/// 简化的模板方法：统一处理配置相关的读操作
pub fn with_config_read<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&AppConfig) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let app = app_lock.read()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp读锁".to_string()))?;
    operation(&app.config)
}

/// 简化的模板方法：统一处理配置相关的写操作
pub fn with_config_write<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&mut AppConfig) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let mut app = app_lock.write()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp写锁".to_string()))?;
    operation(&mut app.config)
}

/// 简化的模板方法：统一处理库管理器相关的读操作
pub fn with_library_read<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&LibraryManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let app = app_lock.read()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp读锁".to_string()))?;
    operation(&app.library_manager)
}

/// 简化的模板方法：统一处理库管理器相关的写操作
pub fn with_library_write<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&mut LibraryManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let mut app = app_lock.write()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp写锁".to_string()))?;
    operation(&mut app.library_manager)
}

/// 简化的模板方法：统一处理历史记录相关的读操作
pub fn with_history_read<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&HistoryManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let app = app_lock.read()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp读锁".to_string()))?;
    operation(&app.history_manager)
}

/// 简化的模板方法：统一处理历史记录相关的写操作
pub fn with_history_write<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&mut HistoryManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let mut app = app_lock.write()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp写锁".to_string()))?;
    operation(&mut app.history_manager)
}

/// 简化的模板方法：统一处理收藏相关的读操作
pub fn with_favorites_read<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&FavoritesManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let app = app_lock.read()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp读锁".to_string()))?;
    operation(&app.favorites_manager)
}

/// 简化的模板方法：统一处理收藏相关的写操作
pub fn with_favorites_write<F, R>(operation: F) -> Result<R>
where
    F: FnOnce(&mut FavoritesManager) -> Result<R>,
{
    let app_lock = mdict_app()?;
    let mut app = app_lock.write()
        .map_err(|_| ZdbError::invalid_parameter("无法获取MdictApp写锁".to_string()))?;
    operation(&mut app.favorites_manager)
}
