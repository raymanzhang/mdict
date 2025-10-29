use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{Result, ZdbError};

/// 外观模式枚举
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum AppearanceMode {
    Auto,
    Light,
    Dark,
}

pub enum Language {
    Auto,
    English,
    Chinese,
}

/// 配置键枚举，用于防止拼写错误
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ConfigKey {
    // 全局设置键
    AppOwner,
    AudioLibPath,
    ExtraLibSearchPath,
    CustomFontPath,
    AutoLookupClipboard,
    MonitorClipboard,
    AutoLookupSelection,
    HotkeyLetter,
    HotkeyModifier,
    UsePopoverForLookup,
    LastMainProfileId,
    
    // 视图设置键
    GuiLanguage,
    AppearanceMode,
    FontFace,
    FontColor,
    BackgroundColor,
    AutoResizeImage,
}

impl ConfigKey {
    /// 获取配置键对应的字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            // 全局设置
            ConfigKey::AppOwner => "app_owner",
            ConfigKey::AudioLibPath => "audio_lib_path",
            ConfigKey::CustomFontPath => "custom_font_path",
            ConfigKey::ExtraLibSearchPath => "extra_lib_search_path",
            ConfigKey::GuiLanguage => "gui_language",
            ConfigKey::AutoLookupClipboard => "auto_lookup_clipboard",
            ConfigKey::MonitorClipboard => "monitor_clipboard",
            ConfigKey::AutoLookupSelection => "auto_lookup_selection",
            ConfigKey::HotkeyLetter => "hotkey_letter",
            ConfigKey::HotkeyModifier => "hotkey_modifier",
            ConfigKey::UsePopoverForLookup => "use_popover_for_lookup",
            ConfigKey::LastMainProfileId => "last_main_profile_id",
            
            // 视图设置
            ConfigKey::AppearanceMode => "appearance_mode",
            ConfigKey::FontFace => "font_face",
            ConfigKey::FontColor => "font_color",
            ConfigKey::BackgroundColor => "background_color",
            ConfigKey::AutoResizeImage => "auto_resize_image",
        }
    }
    
    /// 从字符串创建配置键
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            // 全局设置
            "app_owner" => Some(ConfigKey::AppOwner),
            "audio_lib_path" => Some(ConfigKey::AudioLibPath),
            "custom_font_path" => Some(ConfigKey::CustomFontPath),
            "extra_lib_search_path" => Some(ConfigKey::ExtraLibSearchPath),
            "gui_language" => Some(ConfigKey::GuiLanguage),
            "auto_lookup_clipboard" => Some(ConfigKey::AutoLookupClipboard),
            "monitor_clipboard" => Some(ConfigKey::MonitorClipboard),
            "auto_lookup_selection" => Some(ConfigKey::AutoLookupSelection),
            "hotkey_letter" => Some(ConfigKey::HotkeyLetter),
            "hotkey_modifier" => Some(ConfigKey::HotkeyModifier),
            "use_popover_for_lookup" => Some(ConfigKey::UsePopoverForLookup),
            "last_main_profile_id" => Some(ConfigKey::LastMainProfileId),
            
            // 视图设置
            "appearance_mode" => Some(ConfigKey::AppearanceMode),
            "font_face" => Some(ConfigKey::FontFace),
            "font_color" => Some(ConfigKey::FontColor),
            "background_color" => Some(ConfigKey::BackgroundColor),
            "auto_resize_image" => Some(ConfigKey::AutoResizeImage),
            
            _ => None,
        }
    }
}

/// 配置段落枚举，用于明确指定配置所属的段落
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConfigSection {
    Global,
    View,
}

/// 应用配置结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 全局设置（JSON对象）
    pub global_settings: Value,
    /// 视图设置（JSON对象）
    pub view_settings: Value,
    /// 配置文件路径（不序列化）
    #[serde(skip)]
    pub config_path: Option<PathBuf>,
}

impl Default for AppConfig {
    fn default() -> Self {
        // 注意：为了简化配置管理，已移除了 GlobalSettings 和 ViewSettings 结构体
        // 现在直接使用 JSON 字符串定义默认配置，更加简洁和灵活
        // 使用JSON字符串定义默认的全局设置
        let global_settings_json = r#"{
            "config_version": "1.0",
            "app_owner": "",
            "audio_lib_path": "",
            "gui_language": "",
            "auto_sip": true,   
            "auto_lookup_clipboard": true,  
            "monitor_clipboard": true,
            "auto_lookup_selection": false,
            "hotkey_letter": "",
            "hotkey_modifier": "",
            "use_popover_for_lookup": true,
            "use_tts": true,
            "tts_engine_id": "",
            "extra_lib_search_path": ""
        }"#;

        // 使用JSON字符串定义默认的视图设置
        let view_settings_json = r#"{
            "font_size": "",
            "appearance_mode": "Auto",
            "font_face": "",
            "font_color": "",
            "background_color": "",
            "auto_resize_image": false,
            "background_image": "",
            "custom_font_path": "",
        }"#;

        let global_settings = serde_json::from_str(global_settings_json)
            .unwrap_or(Value::Object(serde_json::Map::new()));
        let view_settings = serde_json::from_str(view_settings_json)
            .unwrap_or(Value::Object(serde_json::Map::new()));
            
        Self {
            global_settings,
            view_settings,
            config_path: None,
        }
    }
}

impl AppConfig {
    /// 创建新的配置实例，从文件加载或使用默认配置
    pub fn new<P: AsRef<Path>>(config_path: P) -> Result<Self> {
        let config_path = config_path.as_ref().to_path_buf();
        
        // 尝试从文件加载配置，如果文件不存在则使用默认配置
        let mut config = if config_path.exists() {
            Self::from_file(&config_path)?
        } else {
            // 使用默认配置并保存到文件
            let default_config = Self::default();
            default_config.to_file(&config_path)?;
            default_config
        };

        // 设置配置文件路径
        config.config_path = Some(config_path);
        Ok(config)
    }

    /// 从文件加载配置
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_buf = path.as_ref().to_path_buf();
        let content = std::fs::read_to_string(&path_buf)?;
        
        let mut config: AppConfig = serde_json::from_str(&content)?;
        
        // 设置配置文件路径
        config.config_path = Some(path_buf);
        
        Ok(config)
    }

    /// 保存配置到文件
    pub fn to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        
        std::fs::write(path, content)?;
        
        Ok(())
    }

    /// 保存当前配置到其配置文件路径
    pub fn save(&self) -> Result<()> {
        if let Some(config_path) = &self.config_path {
            self.to_file(config_path)
        } else {
            Err(ZdbError::invalid_parameter("配置文件路径未设置".to_string()))
        }
    }

    /// 重新加载配置文件
    pub fn reload(&mut self) -> Result<()> {
        if let Some(config_path) = &self.config_path {
            let new_config = Self::from_file(config_path)?;
            self.global_settings = new_config.global_settings;
            self.view_settings = new_config.view_settings;
            Ok(())
        } else {
            Err(ZdbError::invalid_parameter("配置文件路径未设置".to_string()))
        }
    }
    
    /// 通用配置获取方法
    pub fn get_config<T>(&self, section: ConfigSection, config_key: ConfigKey) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let settings = match section {
            ConfigSection::Global => &self.global_settings,
            ConfigSection::View => &self.view_settings,
        };
        
        let key_str = config_key.as_str();
        if let Some(value) = settings.get(key_str) {
            Ok(serde_json::from_value(value.clone())?)
        } else {
            Err(ZdbError::invalid_parameter(format!("配置项 {}.{} 不存在", 
                match section { ConfigSection::Global => "global", ConfigSection::View => "view" }, 
                key_str)))
        }
    }

    /// 通用配置获取方法（带默认值）
    pub fn get_config_with_default<T>(&self, section: ConfigSection, config_key: ConfigKey, default: T) -> T
    where
        T: serde::de::DeserializeOwned + Default,
    {
        self.get_config(section, config_key).unwrap_or(default)
    }

    /// 通用配置设置方法
    pub fn set_config<T>(&mut self, section: ConfigSection, config_key: ConfigKey, value: T) -> Result<()>
    where
        T: serde::Serialize,
    {
        let key_str = config_key.as_str();
        let json_value = serde_json::to_value(value)?;
        
        let settings = match section {
            ConfigSection::Global => &mut self.global_settings,
            ConfigSection::View => &mut self.view_settings,
        };
        
        if let Some(obj) = settings.as_object_mut() {
            obj.insert(key_str.to_string(), json_value);
            Ok(())
        } else {
            Err(ZdbError::invalid_parameter(format!("配置分组 {:?} 不是有效的对象", section)))
        }
    }

}


#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        let appearance_mode: AppearanceMode = config.get_config(ConfigSection::View, ConfigKey::AppearanceMode).unwrap();
        
        assert_eq!(appearance_mode, AppearanceMode::Auto);
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();
        
        let original_clipboard: bool = config.get_config(ConfigSection::Global, ConfigKey::MonitorClipboard).unwrap();
        let deserialized_clipboard: bool = deserialized.get_config(ConfigSection::Global, ConfigKey::MonitorClipboard).unwrap();
        
        assert_eq!(original_clipboard, deserialized_clipboard);
    }

    #[test]
    fn test_config_new_and_save() {
        let temp_dir = env::temp_dir();
        let config_path = temp_dir.join("test_app_config.json");
        
        // 清理之前的测试文件
        if config_path.exists() {
            std::fs::remove_file(&config_path).unwrap();
        }

        // 创建新配置
        let mut config = AppConfig::new(&config_path).unwrap();
        
        // 测试获取配置
        let lib_path: String = config.get_config(ConfigSection::Global, ConfigKey::ExtraLibSearchPath).unwrap();
        assert_eq!(lib_path, "");
        
        // 测试更新配置
        config.set_config(ConfigSection::Global, ConfigKey::ExtraLibSearchPath, "/test/path".to_string()).unwrap();
        config.set_config(ConfigSection::Global, ConfigKey::MonitorClipboard, false).unwrap();
        config.save().unwrap();
        
        // 验证文件存在
        assert!(config_path.exists());
        
        // 从文件重新加载验证保存
        let loaded_config = AppConfig::from_file(&config_path).unwrap();
        let loaded_lib_path: String = loaded_config.get_config(ConfigSection::Global, ConfigKey::ExtraLibSearchPath).unwrap();
        let loaded_clipboard: bool = loaded_config.get_config(ConfigSection::Global, ConfigKey::MonitorClipboard).unwrap();
        assert_eq!(loaded_lib_path, "/test/path");
        assert_eq!(loaded_clipboard, false);
        
        // 清理测试文件
        std::fs::remove_file(&config_path).unwrap();
    }

    
    #[test]
    fn test_generic_config_methods() {
        let mut config = AppConfig::default();
        
        // 测试get_config
        let monitor_clipboard: bool = config.get_config(ConfigSection::Global, ConfigKey::MonitorClipboard).unwrap();
        assert_eq!(monitor_clipboard, true);
        
        // 测试set_config
        config.set_config(ConfigSection::Global, ConfigKey::MonitorClipboard, false).unwrap();
        let updated_clipboard: bool = config.get_config(ConfigSection::Global, ConfigKey::MonitorClipboard).unwrap();
        assert_eq!(updated_clipboard, false);
        
        // 测试get_config_with_default
        let default_lib_path: String = config.get_config_with_default(ConfigSection::Global, ConfigKey::ExtraLibSearchPath, "default_path".to_string());
        assert_eq!(default_lib_path, "");
        
        // 测试设置和获取字符串配置
        config.set_config(ConfigSection::Global, ConfigKey::GuiLanguage, "zh-CN".to_string()).unwrap();
        let language: String = config.get_config(ConfigSection::Global, ConfigKey::GuiLanguage).unwrap();
        assert_eq!(language, "zh-CN");
        
        // 测试设置和获取枚举配置
        config.set_config(ConfigSection::View, ConfigKey::AppearanceMode, AppearanceMode::Auto).unwrap();
        let appearance_mode: AppearanceMode = config.get_config(ConfigSection::View, ConfigKey::AppearanceMode).unwrap();
        assert_eq!(appearance_mode, AppearanceMode::Auto);
        
        // 测试通用配置方法：恢复剪贴板设置并验证
        config.set_config(ConfigSection::Global, ConfigKey::MonitorClipboard, true).unwrap();
        let clipboard_enabled: bool = config.get_config_with_default(ConfigSection::Global, ConfigKey::MonitorClipboard, false);
        assert!(clipboard_enabled);
    }
}