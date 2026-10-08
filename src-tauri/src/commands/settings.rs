use tauri::AppHandle;

use crate::settings::{self, AppSettings, ModelInfo};
use crate::shortcut;

/// Returns the current application settings (with defaults for missing keys).
#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    settings::get_settings(&app)
}

/// Returns the list of realtime transcription models available for selection.
#[tauri::command]
pub fn get_models() -> Vec<ModelInfo> {
    settings::list_models()
}

/// Persists the application settings.
///
/// If the shortcut changed, the global shortcut is re-registered so the new
/// binding takes effect immediately.
#[tauri::command]
pub fn set_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let previous = settings::get_settings(&app);
    let shortcut_changed = previous.shortcut != settings.shortcut;

    settings::set_settings(&app, &settings)?;

    if shortcut_changed {
        let _ = shortcut::unregister(&app, &previous.shortcut);
        shortcut::register(&app, &settings.shortcut)?;
    }

    Ok(())
}

/// Marks first-run host setup as complete (or skipped), so the onboarding
/// screen no longer appears on subsequent launches.
#[tauri::command]
pub fn mark_setup_complete(app: AppHandle) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.setup_completed = true;
    settings::set_settings(&app, &settings)
}
