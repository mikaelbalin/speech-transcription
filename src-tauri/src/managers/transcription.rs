use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

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
    /// The accumulated transcript of the current session. Shared so an external
    /// command (e.g. the overlay's "clear" button) can reset it mid-session.
    transcript: Arc<Mutex<String>>,
}

impl TranscriptionManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            transcript: Arc::new(Mutex::new(String::new())),
        }
    }

    /// Starts a dictation session. Returns immediately; the work runs on a
    /// background thread. No-op if a session is already running.
    pub fn start(&self, app: AppHandle) {
        if self.running.swap(true, Ordering::AcqRel) {
            return; // already running
        }

        self.paused.store(false, Ordering::Release);
        self.transcript.lock().unwrap().clear();

        let running = Arc::clone(&self.running);
        let paused = Arc::clone(&self.paused);
        let transcript = Arc::clone(&self.transcript);
        std::thread::spawn(move || {
            let result = run_session(&app, &running, &paused, &transcript);
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

    /// Clears the accumulated transcript of the current session. The overlay's
    /// "clear" button calls this so the final paste does not include previously
    /// dictated text.
    pub fn clear_transcript(&self) {
        self.transcript.lock().unwrap().clear();
    }
}

/// Runs the full capture → transcribe → paste flow.
fn run_session(
    app: &AppHandle,
    running: &AtomicBool,
    paused: &AtomicBool,
    transcript: &Arc<Mutex<String>>,
) -> Result<(), String> {
    // Install the Rustls crypto provider (ring) before the first TLS connection.
    // Safe to call repeatedly; ignores the error if already installed.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let settings = get_settings(app);

    crate::overlay::show_overlay(app);

    // Snapshot the clipboard once for the whole session. The transcript is
    // pasted only once at the end, so the clipboard is modified a single time;
    // the snapshot restores the user's original content on drop (including error
    // paths), and no intermediate content leaks into the clipboard history.
    let _paste_guard = crate::paste::PasteSessionGuard::new(app);

    let mut recorder =
        crate::audio::start_recorder(settings.sample_rate, &settings.input_device_id)?;

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

    rt.block_on(async {
        let session =
            MistralSession::connect(&settings.base_url, &settings.api_key, &settings.model).await?;
        let (mut writer, mut reader) = (session.writer, session.reader);

        // The accumulated transcript for the whole session. Deltas are appended
        // here as they arrive and broadcast to the overlay for live display, but
        // the text is only pasted once — at the end of the session — so the
        // clipboard is touched a single time.
        //
        // The transcript is shared with `TranscriptionManager` so the overlay's
        // "clear" button can reset it mid-session.
        let app_events = app.clone();
        let transcript_clone = Arc::clone(transcript);
        let event_task = tokio::spawn(async move {
            while let Some(ev) = reader.next().await {
                match ev? {
                    TranscriptionEvent::SessionCreated => {}
                    TranscriptionEvent::TextDelta { text } => {
                        transcript_clone.lock().unwrap().push_str(&text);
                        let _ = app_events.emit("transcription-delta", text);
                    }
                    TranscriptionEvent::Done => {
                        // Signal the frontend that the session is finished.
                        let _ = app_events.emit("transcription-done", "");
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

        // Paste the full transcript once, at the end of the session. This is the
        // only time the clipboard is touched, so the user's pre-dictation
        // clipboard content stays intact and their history is not polluted.
        let transcript = transcript.lock().unwrap().clone();
        finalize(app, &transcript);

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

/// Inserts text into the focused field.
fn finalize(app: &AppHandle, text: &str) {
    if text.trim().is_empty() {
        return;
    }
    match crate::paste::paste(app, text) {
        Ok(()) => {}
        Err(e) => {
            let _ = app.emit("transcription-error", e.clone());
            crate::overlay::emit_overlay(app, "transcription-error", e);
        }
    }
}
