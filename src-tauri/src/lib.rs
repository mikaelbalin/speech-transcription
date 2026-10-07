mod audio;
mod commands;
mod managers;
mod mistral;
mod overlay;
mod paste;
mod settings;
mod shortcut;

use std::sync::Arc;

use managers::TranscriptionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Arc::new(TranscriptionManager::new()))
        .setup(|app| {
            let settings = settings::get_settings(app.handle());
            let _ = shortcut::register(app.handle(), &settings.shortcut);
            overlay::create_overlay(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::set_settings,
            commands::audio::get_devices,
            commands::transcription::start_transcription,
            commands::transcription::stop_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
