use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Registers the global dictation toggle shortcut.
///
/// Emits a `toggle-dictation` event to the frontend on each press. The shortcut
/// is read from settings; re-register after a settings change.
pub fn register(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut '{shortcut}': {e}"))?;

    app.global_shortcut()
        .on_shortcut(parsed, move |app_handle, _scut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app_handle.emit("toggle-dictation", ());
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{shortcut}': {e}"))?;

    Ok(())
}

/// Unregisters the given shortcut (used before re-registering on change).
pub fn unregister(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut '{shortcut}': {e}"))?;

    app.global_shortcut()
        .unregister(parsed)
        .map_err(|e| format!("Failed to unregister shortcut '{shortcut}': {e}"))
}
