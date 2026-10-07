use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{AppHandle, Emitter};

use crate::audio::AudioSource;
use crate::mistral::{MistralSession, TranscriptionEvent};
use crate::settings::get_settings;

/// Orchestrates a single dictation session: capture audio, stream it to the
/// Mistral realtime API, accumulate deltas, and paste the finalized text.
///
/// Kept deliberately simple: one session at a time, guarded by an atomic flag.
pub struct TranscriptionManager {
    running: Arc<AtomicBool>,
}

impl TranscriptionManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Starts a dictation session. Returns immediately; the work runs on a
    /// background thread. No-op if a session is already running.
    pub fn start(&self, app: AppHandle) {
        if self.running.swap(true, Ordering::AcqRel) {
            return; // already running
        }

        let running = Arc::clone(&self.running);
        std::thread::spawn(move || {
            let result = run_session(&app, &running);
            if let Err(e) = result {
                let _ = app.emit("transcription-error", e);
            }
            running.store(false, Ordering::Release);
        });
    }

    /// Requests the current session to stop after the next chunk.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Release);
    }
}

/// Runs the full capture → transcribe → paste flow.
fn run_session(app: &AppHandle, running: &AtomicBool) -> Result<(), String> {
    // Install the Rustls crypto provider (ring) before the first TLS connection.
    // Safe to call repeatedly; ignores the error if already installed.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let settings = get_settings(app);

    crate::overlay::show_overlay(app);

    let mut recorder =
        crate::audio::start_recorder(settings.sample_rate, &settings.input_device_id)?;

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

    rt.block_on(async {
        let session =
            MistralSession::connect(&settings.base_url, &settings.api_key, &settings.model).await?;
        let (mut writer, mut reader) = (session.writer, session.reader);

        // Shared accumulation buffer for the event loop.
        let buffer = Arc::new(std::sync::Mutex::new(String::new()));

        // Event loop: read events, accumulate deltas, finalize on `done`.
        let app_events = app.clone();
        let buffer_events = Arc::clone(&buffer);
        let event_task = tokio::spawn(async move {
            while let Some(ev) = reader.next().await {
                match ev? {
                    TranscriptionEvent::SessionCreated => {}
                    TranscriptionEvent::TextDelta { text } => {
                        buffer_events.lock().unwrap().push_str(&text);
                        let _ = app_events.emit("transcription-delta", text);
                    }
                    TranscriptionEvent::Done => {
                        let mut b = buffer_events.lock().unwrap();
                        finalize(&app_events, &b);
                        b.clear();
                    }
                    TranscriptionEvent::Error { error } => {
                        return Err(error.map(|e| e.to_string()).unwrap_or_default());
                    }
                }
            }
            Ok(())
        });

        // Audio loop: capture and send until told to stop.
        while running.load(Ordering::Acquire) {
            let Some(chunk) = recorder.next_chunk() else {
                break;
            };
            writer.send(&chunk).await?;
        }
        let _ = writer.finish().await;

        // Wait for the event loop to finish draining.
        let _ = event_task.await;

        // Paste any remaining accumulated text.
        let b = buffer.lock().unwrap();
        if !b.is_empty() {
            finalize(app, &b);
        }

        crate::overlay::hide_overlay(app);

        Ok(())
    })
}

/// Inserts finalized text into the focused field and emits a `done` event.
fn finalize(app: &AppHandle, text: &str) {
    if text.trim().is_empty() {
        eprintln!("[finalize] empty text, skipping paste");
        return;
    }
    eprintln!("[finalize] pasting: {:?}", text);
    match crate::paste::paste(app, text) {
        Ok(()) => {
            let _ = app.emit("transcription-done", text.to_string());
        }
        Err(e) => {
            eprintln!("[finalize] paste error: {e}");
            let _ = app.emit("transcription-error", e);
        }
    }
}
