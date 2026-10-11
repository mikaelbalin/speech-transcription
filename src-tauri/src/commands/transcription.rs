use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

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

/// Pauses the current session: audio stops being sent to Mistral while the
/// connection stays open. Emits a `paused` event so the overlay can update.
#[tauri::command]
pub fn pause_transcription(app: AppHandle, manager: State<'_, Arc<TranscriptionManager>>) {
    if manager.pause() {
        let _ = app.emit("paused", ());
    }
}

/// Resumes a paused session. Emits a `resumed` event.
#[tauri::command]
pub fn resume_transcription(app: AppHandle, manager: State<'_, Arc<TranscriptionManager>>) {
    if manager.resume() {
        let _ = app.emit("resumed", ());
    }
}

/// Clears the accumulated transcript of the current session. Called by the
/// overlay's "clear" button so the final paste excludes previously dictated
/// text.
#[tauri::command]
pub fn clear_transcription(manager: State<'_, Arc<TranscriptionManager>>) {
    manager.clear_transcript();
}
