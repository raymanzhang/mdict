use crate::error::{Result, ZdbError};

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default, Hash)]
#[repr(i32)]
pub enum MdxAction {
    #[default]
    Unknown,
    Entry,
    EntryX,
    HProgEntry,
    HProgEntryX,
    ProgEntry,
    ProgEntryX,
    IFrame,
    Mdd,
    Res,
    EncryptedRes,
    File,
    Sound,
    Launch,
    Debug,
    ViewImage,
    Info,
    Notify,
}

impl MdxAction {
    pub fn from_str(s: &str) -> MdxAction {
        match s {
            "iframe" => MdxAction::IFrame,
            "res" => MdxAction::Res,
            "eres" => MdxAction::EncryptedRes,
            "file" => MdxAction::File,
            "view_image" => MdxAction::ViewImage,
            "sound" => MdxAction::Sound,
            "entry" => MdxAction::Entry,
            "prog_entry" => MdxAction::ProgEntry,
            "h_prog_entry" => MdxAction::HProgEntry,
            "entryx" => MdxAction::EntryX,
            "prog_entryx" => MdxAction::ProgEntryX,
            "h_prog_entryx" => MdxAction::HProgEntryX,
            "mdd" => MdxAction::Mdd,
            "launch" => MdxAction::Launch,
            "debug" => MdxAction::Debug,
            "notify" => MdxAction::Notify,
            "info" => MdxAction::Info,
            _ => MdxAction::Unknown,
        }
    }
}

/// Mdx url is like http://mdict.cn/service/action?parameters
/// 只解析action部分，参数解析留给具体的handler处理
pub fn parse_mdx_url(url: &str, base_url: &str) -> Result<MdxAction> {
    let base_url = base_url.replace("http.localhost", "localhost");
    let path_with_action = url.strip_prefix(&base_url).unwrap_or("");
    // 只获取去掉base_path后的第一层路径
    let action_str = path_with_action
        .split('?')
        .next()
        .unwrap_or(path_with_action);

    let action = MdxAction::from_str(action_str);


    if action != MdxAction::Unknown {
        // 只返回解析到的action
        Ok(action)
    } else {
        Err(ZdbError::invalid_parameter(format!("Invalid action: {}", action_str)))
    }
}
