// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use mdict_app_lib;
fn main() {
    mdict_app_lib::run()
}
