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
/// A session can be paused — while paused, captured audio chunks are dropped
/// instead of being sent to Mistral, but the WebSocket connection stays open so
/// resuming is instant (no reconnect).
pub struct TranscriptionManager {
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
}

impl TranscriptionManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Starts a dictation session. Returns immediately; the work runs on a
    /// background thread. No-op if a session is already running.
    pub fn start(&self, app: AppHandle) {
        if self.running.swap(true, Ordering::AcqRel) {
            return; // already running
        }

        self.paused.store(false, Ordering::Release);

        let running = Arc::clone(&self.running);
        let paused = Arc::clone(&self.paused);
        std::thread::spawn(move || {
            let result = run_session(&app, &running, &paused);
            if let Err(e) = result {
                let _ = app.emit("transcription-error", e);
            }
            running.store(false, Ordering::Release);
            paused.store(false, Ordering::Release);
        });
    }

    /// Requests the current session to stop after the next chunk.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Release);
    }

    /// Pauses the current session: audio chunks stop being sent to Mistral, but
    /// the connection stays open. No-op if not running or already paused.
    pub fn pause(&self) -> bool {
        if !self.running.load(Ordering::Acquire) {
            return false;
        }
        self.paused.store(true, Ordering::Release);
        true
    }

    /// Resumes a paused session. No-op if not running or not paused.
    pub fn resume(&self) -> bool {
        if !self.running.load(Ordering::Acquire) {
            return false;
        }
        self.paused.store(false, Ordering::Release);
        true
    }
}

/// Runs the full capture → transcribe → paste flow.
fn run_session(app: &AppHandle, running: &AtomicBool, paused: &AtomicBool) -> Result<(), String> {
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

        // Audio loop: capture and send until told to stop. While streaming,
        // also emit the instantaneous input level so the overlay can render a
        // live volume meter without capturing the microphone itself. While
        // paused, chunks are drained (so the recorder pipe doesn't back up) but
        // dropped instead of being sent to Mistral — the connection stays open.
        while running.load(Ordering::Acquire) {
            let Some(chunk) = recorder.next_chunk() else {
                break;
            };
            if paused.load(Ordering::Acquire) {
                continue;
            }
            crate::overlay::emit_overlay(app, "audio-level", rms_level(&chunk));
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

/// Computes the root-mean-square level of a `pcm_s16le` mono chunk, normalized
/// to `0.0..=1.0`. Used to drive the overlay's live volume meter.
fn rms_level(chunk: &[u8]) -> f64 {
    if chunk.len() < 2 {
        return 0.0;
    }
    // Interpret pairs of little-endian bytes as i16 samples.
    let samples = chunk.chunks_exact(2);
    let mut sum_squares = 0f64;
    let mut count = 0usize;
    for pair in samples {
        let sample = i16::from_le_bytes([pair[0], pair[1]]) as f64;
        sum_squares += sample * sample;
        count += 1;
    }
    if count == 0 {
        return 0.0;
    }
    let rms = (sum_squares / count as f64).sqrt();
    // Normalize against i16 max amplitude (32768), then apply a gentle gain so
    // quiet speech still produces a visible meter.
    (rms / 32768.0 * 5.0).min(1.0)
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
            let _ = app.emit("transcription-error", e.clone());
            crate::overlay::emit_overlay(app, "transcription-error", e);
        }
    }
}
