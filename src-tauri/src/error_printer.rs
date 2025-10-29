use colored::Colorize;
pub fn format_error(error: &mdx::ZdbError) -> String{
    let mut output = String::new();
    output.push_str(&format!("Error: {}\n", error.to_string().red().bold()));
    if let Some(backtrace) = mdx::snafu::ErrorCompat::backtrace(error){

        // Add backtrace header in red, mimicking color-backtrace
        output.push_str(&format!("{}:\n", "BACKTRACE"));
    
        // Convert backtrace to string and split into lines
        let backtrace_str = format!("{}", backtrace);
        for line in backtrace_str.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
    
            if line.starts_with("at ") {
                if let Some((_, file_info)) = line.split_once("at ") {
                    let file_info = file_info.trim().green();
                    output.push_str(&format!("        at {}\n", file_info));
                } else {
                    output.push_str(&format!("        {}\n", line.white()));
                }
            }else{
                // Check if line starts with a frame number (e.g., "0:", "1:")
                if let Some((frame_num, rest)) = line.split_once(':') {
                    output.push_str(&format!("{}: {}\n", frame_num.trim().yellow().bold(), rest.cyan()));
                } else {
                    // Fallback for unexpected line formats
                    output.push_str(&format!("{}\n", line.white()));
                }
            }
        }
    }
    output
}
