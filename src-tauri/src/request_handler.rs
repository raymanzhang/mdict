// 处理webview的URL请求
use log::debug;
use tauri::http::{Request, Response, StatusCode};
use url::Url;

use crate::action_handlers::get_action_handler;
use crate::error::{Result, ZdbError};
use crate::error_printer::format_error;
use crate::mdx_url_parser::parse_mdx_url;

/// 处理MDX URL请求的函数
fn handle_mdx_url(url: &str, base_url: &str) -> Result<Response<Vec<u8>>> {
        
    let action = parse_mdx_url(&url, base_url)?;
    
    // 使用action handler处理请求
    let handler = get_action_handler(action)
        .ok_or_else(|| ZdbError::invalid_parameter(format!("Unsupported action: {:?}", action)))?;
    
    let response = handler.handle(&Url::parse(url)?, action)?;
    
    Ok(response)
}

/// 为响应添加 CORS headers
fn add_cors_headers(response: &mut Response<Vec<u8>>) {
    response.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
    response.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
    response.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
}

pub fn handle_request(request: &Request<Vec<u8>>, base_url: &str) -> std::result::Result<Response<Vec<u8>>, Box<dyn std::error::Error>> {
    let uri = request.uri().to_string();
    debug!("Handling request: {}", uri);
    match handle_mdx_url(&uri, base_url) {
        Ok(mut response) => {
            // 统一添加 CORS headers
            add_cors_headers(&mut response);
            Ok(response)
        },
        Err(error) => {
            let error_message = format_error(&error);
            
            // Determine HTTP status code based on error type
            let status_code = if let ZdbError::KeyNotFound { .. } = &error {
                log::info!("Key not found: {}", uri);
                StatusCode::NOT_FOUND
            } else {
                log::error!("Error handling MDX URL {}: {}", uri, error_message);
                StatusCode::INTERNAL_SERVER_ERROR
            };
            
            let error_html = format!(
                "<html><body><h1>Error</h1><p>Failed to load content: {}</p></body></html>", 
                error_message
            );
            let mut response = Response::new(error_html.into_bytes());
            *response.status_mut() = status_code;
            response.headers_mut().insert("Content-Type", "text/html; charset=utf-8".parse().unwrap());
            // 错误响应也添加 CORS headers
            add_cors_headers(&mut response);
            Ok(response)
        }
    }
}

