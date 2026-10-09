use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "linux")]
mod uinput_impl;

#[cfg(not(target_os = "linux"))]
mod enigo_impl;

/// The original clipboard content, saved at the start of a paste session and
/// restored at the end. `None` means either no session is active, or the
/// clipboard was originally empty.
static SAVED_CLIPBOARD: Mutex<Option<Option<String>>> = Mutex::new(None);

/// Begins a paste session: snapshots the current clipboard so it can be
/// restored later. Call once before a burst of `paste` calls (e.g. at the
/// start of a dictation session).
///
/// Idempotent: if a session is already active, the existing snapshot is kept.
pub fn begin_paste_session(app: &AppHandle) {
    let mut guard = SAVED_CLIPBOARD.lock().unwrap();
    if guard.is_some() {
        return;
    }
    *guard = Some(app.clipboard().read_text().ok());
}

/// Ends a paste session: restores the clipboard to its pre-session content and
/// clears the saved snapshot.
pub fn end_paste_session(app: &AppHandle) {
    let saved = match SAVED_CLIPBOARD.lock().unwrap().take() {
        Some(saved) => saved,
        None => return,
    };
    match saved {
        Some(previous) => {
            let _ = app.clipboard().write_text(previous);
        }
        None => {
            let _ = app.clipboard().clear();
        }
    }
}

/// RAII guard that restores the clipboard on drop. Prefer this over manual
/// `begin`/`end` pairing so the clipboard is restored even on error paths.
pub struct PasteSessionGuard {
    app: AppHandle,
}

impl PasteSessionGuard {
    pub fn new(app: &AppHandle) -> Self {
        begin_paste_session(app);
        Self { app: app.clone() }
    }
}

impl Drop for PasteSessionGuard {
    fn drop(&mut self) {
        end_paste_session(&self.app);
    }
}

/// Inserts `text` into the currently focused field by writing it to the
/// clipboard and sending a paste keystroke.
///
/// - Windows/macOS/X11: `enigo` sends Ctrl+V / Cmd+V.
/// - Linux Wayland: `uinput` virtual keyboard sends Ctrl+V.
///
/// On Linux, if `/dev/uinput` is unavailable (no permissions), falls back to
/// writing the clipboard only — the user must press Ctrl+V manually.
///
/// Clipboard save/restore is handled at the session level (see
/// `begin_paste_session` / `end_paste_session`), so this function does not
/// touch the original clipboard and avoids per-paste delays.
pub fn paste(app: &AppHandle, text: &str) -> Result<(), String> {
    // Write the transcription to the clipboard.
    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| format!("Failed to write clipboard: {e}"))?;

    // On Wayland the clipboard is owned by the compositor and `write_text` does
    // an asynchronous round-trip (via wl-clipboard/xclip). If we send the paste
    // keystroke immediately, the target app can paste stale/empty content and
    // truncate the beginning of the text. Give the clipboard a moment to settle
    // before pasting.
    #[cfg(target_os = "linux")]
    std::thread::sleep(std::time::Duration::from_millis(50));

    let result = send_paste_keystroke();

    result
}

/// Sends the platform-appropriate paste keystroke.
fn send_paste_keystroke() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        uinput_impl::send_paste()
    }
    #[cfg(not(target_os = "linux"))]
    {
        enigo_impl::send_paste()
    }
}
