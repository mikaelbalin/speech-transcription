use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::managers::TranscriptionManager;

/// Starts a dictation session.
#[tauri::command]
pub fn start_transcription(app: AppHandle, manager: State<'_, Arc<TranscriptionManager>>) {
    manager.start(app);
}

/// Stops the current dictation session.
#[tauri::command]
pub fn stop_transcription(manager: State<'_, Arc<TranscriptionManager>>) {
    manager.stop();
}
