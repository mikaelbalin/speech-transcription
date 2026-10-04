use tauri::AppHandle;

use crate::settings::{self, AppSettings};

/// Returns the current application settings (with defaults for missing keys).
#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    settings::get_settings(&app)
}

/// Persists the application settings.
#[tauri::command]
pub fn set_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    settings::set_settings(&app, &settings)
}
