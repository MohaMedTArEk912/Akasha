// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let headless = std::env::var("GRAPES_HEADLESS")
        .ok()
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);

    if headless {
        if let Err(e) = grapes_ide_lib::run_headless() {
            eprintln!("Headless server failed: {e}");
            std::process::exit(1);
        }
        return;
    }

    grapes_ide_lib::run()
}
