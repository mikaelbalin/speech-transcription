//! Global shortcut registration for toggling dictation.
//!
//! On Linux, global shortcuts are captured by reading the physical keyboard
//! via `evdev` (see [`crate::keyboard_listener`]), because
//! `tauri-plugin-global-shortcut` only works over X11 and fails silently on
//! Wayland. On other platforms the plugin is used directly.
//!
//! The shortcut is read from settings; re-register after a settings change.

#[cfg(target_os = "linux")]
mod linux {
    use std::sync::Mutex;

    use tauri::AppHandle;

    use crate::keyboard_listener::{self, ListenerState};

    /// The running listener, if any. Kept so the active shortcut can be updated
    /// or the listener torn down on re-registration.
    static LISTENER: Mutex<Option<ListenerState>> = Mutex::new(None);

    /// Registers the Linux `evdev` listener for the given shortcut.
    pub fn register(app: &AppHandle, shortcut: &str) -> Result<(), String> {
        let mut guard = LISTENER.lock().unwrap();
        match guard.as_ref() {
            Some(state) => state.set_shortcut(shortcut),
            None => {
                let state = keyboard_listener::start(app.clone(), shortcut);
                *guard = Some(state);
            }
        }
        Ok(())
    }

    /// Unregisters the current listener (used before re-registering on change).
    pub fn unregister(_app: &AppHandle, _shortcut: &str) -> Result<(), String> {
        if let Some(state) = LISTENER.lock().unwrap().take() {
            state.shutdown();
        }
        Ok(())
    }
}

#[cfg(not(target_os = "linux"))]
mod non_linux {
    use tauri::{AppHandle, Emitter};
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

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

    pub fn unregister(app: &AppHandle, shortcut: &str) -> Result<(), String> {
        let parsed: Shortcut = shortcut
            .parse()
            .map_err(|e| format!("Invalid shortcut '{shortcut}': {e}"))?;

        app.global_shortcut()
            .unregister(parsed)
            .map_err(|e| format!("Failed to unregister shortcut '{shortcut}': {e}"))
    }
}

#[cfg(target_os = "linux")]
pub use linux::{register, unregister};

#[cfg(not(target_os = "linux"))]
pub use non_linux::{register, unregister};
