use log::error;

use mdx::Result;

use crate::error_printer;

pub fn log_if_err(e: &Result<()>) {
    if let Err(e) = e {
        error!("{}", error_printer::format_error(&e));
    }
}