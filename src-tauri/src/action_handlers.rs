use percent_encoding::percent_decode_str;
use tauri::http::{Response, StatusCode};
use url::Url;

use mdx::storage::{EntryNo, KeyIndex};

use crate::error::{Result, ZdbError};
use crate::mdict_app::{with_read_access, with_write_access};
use crate::mdx_db::MdxIndex;
use crate::mdx_profile::ProfileId;
use crate::mdx_url_parser::MdxAction;

/// Action handler trait
pub trait ActionHandler {
    fn handle(&self, url: &Url, action: MdxAction) -> Result<Response<Vec<u8>>>;
}

/// 获取URL查询参数的辅助函数
fn get_param(url: &Url, key: &str) -> Result<String> {
    for (k, v) in url.query_pairs() {
        if k == key {
            return Ok(v.to_string());
        }
    }
    Err(ZdbError::invalid_parameter(format!("Parameter {} not found", key)))
}

/// 根据文件扩展名确定MIME类型
fn get_mime_type(file_path: &str) -> String {
    use mime_guess::{from_path, mime};
    
    let mime_type = from_path(file_path).first_or_octet_stream();
    
    // 对于HTML文件，确保包含charset=utf-8
    if mime_type.type_() == mime::TEXT && mime_type.subtype() == mime::HTML {
        "text/html; charset=utf-8".to_string()
    } else {
        mime_type.to_string()
    }
}

/// 构建 HTTP Response 的辅助函数
fn build_response(status_code: StatusCode, content_type: &str, data: Vec<u8>) -> Response<Vec<u8>> {
    let mut response = Response::new(data);
    *response.status_mut() = status_code;
    response.headers_mut().insert("Content-Type", content_type.parse().unwrap());
    response
}

/// 获取单个条目的HTML内容
pub fn get_entry_html_by_index(index:&MdxIndex) -> Result<String> {
    with_write_access(|app| app.get_entry_html_by_index(index))
}

/// 获取MDD数据
pub fn get_mdd_data(profile_id: &ProfileId, filename: &str) -> Result<Option<(Vec<u8>, String)>> {
    with_write_access(|app| app.get_mdd_data(profile_id, filename))
}

/// 获取asset文件内容（二进制）
pub fn get_asset(filename: &str) -> Result<Option<Vec<u8>>> {
    with_read_access(|app| app.get_asset(filename).map(|opt| opt.cloned()))
}

/// 资源文件处理器 (Res, EncryptedRes)
pub struct ResHandler;

impl ActionHandler for ResHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let path_with_action = url.path().strip_prefix("/service/").unwrap_or(url.path());
        let action_str = path_with_action.split('/').next().unwrap_or(path_with_action);
        let real_path = path_with_action.strip_prefix(action_str).unwrap_or(path_with_action).to_string();
        
        let decoded_path = percent_decode_str(&real_path).decode_utf8()?.to_string();
        let content_type = get_mime_type(&decoded_path);
        let data = get_asset(&decoded_path)?;
        
        match data {
            Some(data) => Ok(build_response(StatusCode::OK, &content_type, data)),
            None => Ok(build_response(StatusCode::NOT_FOUND, "text/plain", "Not found".as_bytes().to_vec())),
        }
    }
}

/// 词条索引处理器 (EntryX, ProgEntryX, HProgEntryX)
pub struct EntryXHandler;

impl ActionHandler for EntryXHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let profile_id = get_param(url, "profile_id")?.parse::<ProfileId>()?;
        let entry_no = get_param(url, "entry_no")?.parse::<EntryNo>()?;
        
        let mdx_index = MdxIndex {
            profile_id,
            key_index: KeyIndex {
                entry_no,
                key: String::new(),
                content_offset_in_source: 0,
                key_raw: String::new().into_bytes(),
                sort_key: String::new().into_bytes(),
            },
        };
        
        let html = get_entry_html_by_index(&mdx_index)?;
        
        Ok(build_response(StatusCode::OK, "text/html; charset=utf-8", html.into_bytes()))
    }
}

/// MDD文件处理器 (Mdd, File)
pub struct MddHandler;

impl ActionHandler for MddHandler {
    fn handle(&self, url: &Url, action: MdxAction) -> Result<Response<Vec<u8>>> {
        let (profile_id, filename) = if action == MdxAction::File {
            // file:// URL
            let profile_id = 0; // 默认profile_id，可能需要调整
            let filename = url.path().to_string();
            (profile_id, filename)
        } else {
            // mdx:// URL
            let profile_id = get_param(url, "profile_id")?.parse::<ProfileId>()?;
            let key = get_param(url, "key")?;
            let decoded_key = percent_decode_str(&key).decode_utf8()?.to_string();
            (profile_id, decoded_key)
        };
        
        let data = get_mdd_data(&profile_id, &filename)?;
        if let Some((data, content_type)) = data {
            Ok(build_response(StatusCode::OK, &content_type, data))
        } else {
            Ok(build_response(StatusCode::NOT_FOUND, "text/plain", "Not found".as_bytes().to_vec()))
        }        
    }
}

/// IFrame处理器
pub struct IFrameHandler;

impl ActionHandler for IFrameHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let profile_id = get_param(url, "profile_id")?.parse::<ProfileId>()?;
        let entry_no = get_param(url, "entry_no")?.parse::<EntryNo>()?;
        
        let mdx_index = MdxIndex {
            profile_id,
            key_index: KeyIndex {
                entry_no,
                key: String::new(),
                content_offset_in_source: 0,
                key_raw: String::new().into_bytes(),
                sort_key: String::new().into_bytes(),
            },
        };
        
        let html = get_entry_html_by_index(&mdx_index)?;
        
        Ok(build_response(StatusCode::OK, "text/html; charset=utf-8", html.into_bytes()))
    }
}

/// 调试信息处理器 (Debug, Notify, Info)
pub struct DebugHandler;

impl ActionHandler for DebugHandler {
    fn handle(&self, url: &Url, action: MdxAction) -> Result<Response<Vec<u8>>> {
        let message = get_param(url, "message").unwrap_or_else(|_| "No message".to_string());
        let decoded_message = percent_decode_str(&message).decode_utf8()?.to_string();
        
        log::info!("{:?}: {}", action, decoded_message);

        Ok(build_response(StatusCode::OK, "text/html; charset=utf-8", "{}".as_bytes().to_vec()))
    }
}

/// Launch处理器
pub struct LaunchHandler;

impl ActionHandler for LaunchHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let _x = get_param(url, "x")?.parse::<i32>()?;
        let _y = get_param(url, "y")?.parse::<i32>()?;
        let _width = get_param(url, "width")?.parse::<i32>()?;
        let _height = get_param(url, "height")?.parse::<i32>()?;
        let key = get_param(url, "key")?;
        let decoded_key = percent_decode_str(&key).decode_utf8()?.to_string();
        
        // 这里可以根据需要使用位置和尺寸信息
        // 暂时返回简单的响应
        let response_html = format!("<html><body><p>Launch: {}</p></body></html>", decoded_key);
        
        Ok(build_response(StatusCode::OK, "text/html; charset=utf-8", response_html.into_bytes()))
    }
}

/// Sound处理器
pub struct SoundHandler;

impl ActionHandler for SoundHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let profile_id = get_param(url, "profile_id")?.parse::<ProfileId>()?;
        let key = get_param(url, "key")?;
        let decoded_key = percent_decode_str(&key).decode_utf8()?.to_string();
        
        // 音频文件通常通过MDD处理
        let data = get_mdd_data(&profile_id, &decoded_key)?;
        if let Some((data, content_type)) = data {
            Ok(build_response(StatusCode::OK, &content_type, data))
        } else {
            Ok(build_response(StatusCode::NOT_FOUND, "text/plain", "Not found".as_bytes().to_vec()))
        }
        
    }
}

/// ViewImage处理器
pub struct ViewImageHandler;

impl ActionHandler for ViewImageHandler {
    fn handle(&self, url: &Url, _action: MdxAction) -> Result<Response<Vec<u8>>> {
        let path_with_action = url.path().strip_prefix("/service/").unwrap_or(url.path());
        let action_str = path_with_action.split('/').next().unwrap_or(path_with_action);
        let real_path = path_with_action.strip_prefix(action_str).unwrap_or(path_with_action).to_string();
        
        let decoded_path = percent_decode_str(&real_path).decode_utf8()?.to_string();
        let content_type = get_mime_type(&decoded_path);
        let data = get_asset(&decoded_path)?;
        
        match data {
            Some(data) => Ok(build_response(StatusCode::OK, &content_type, data)),
            None => Ok(build_response(StatusCode::NOT_FOUND, "text/plain", "Not found".as_bytes().to_vec())),
        }
    }
}


/// 获取action handler
pub fn get_action_handler(action: MdxAction) -> Option<Box<dyn ActionHandler + Send + Sync>> {
    match action {
        MdxAction::Res | MdxAction::EncryptedRes => Some(Box::new(ResHandler)),
        MdxAction::ViewImage => Some(Box::new(ViewImageHandler)),
        MdxAction::Sound => Some(Box::new(SoundHandler)),
        MdxAction::EntryX | MdxAction::ProgEntryX | MdxAction::HProgEntryX => Some(Box::new(EntryXHandler)),
        MdxAction::Mdd | MdxAction::File => Some(Box::new(MddHandler)),
        MdxAction::IFrame => Some(Box::new(IFrameHandler)),
        MdxAction::Debug | MdxAction::Notify | MdxAction::Info => Some(Box::new(DebugHandler)),
        MdxAction::Launch => Some(Box::new(LaunchHandler)),
        _ => None,
    }
}
