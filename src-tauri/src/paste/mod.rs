use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "linux")]
mod uinput_impl;

#[cfg(not(target_os = "linux"))]
mod enigo_impl;

/// Inserts `text` into the currently focused field by writing it to the
/// clipboard and sending a paste keystroke.
///
/// - Windows/macOS/X11: `enigo` sends Ctrl+V / Cmd+V.
/// - Linux Wayland: `uinput` virtual keyboard sends Ctrl+V.
///
/// On Linux, if `/dev/uinput` is unavailable (no permissions), falls back to
/// writing the clipboard only — the user must press Ctrl+V manually.
pub fn paste(app: &AppHandle, text: &str) -> Result<(), String> {
    // Save current clipboard text (if any) to restore afterwards.
    let saved = app.clipboard().read_text().ok();

    // Write the transcription to the clipboard.
    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| format!("Failed to write clipboard: {e}"))?;

    let result = send_paste_keystroke();

    // Restore the original clipboard content.
    match saved {
        Some(previous) => {
            let _ = app.clipboard().write_text(previous);
        }
        None => {
            let _ = app.clipboard().clear();
        }
    }

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
