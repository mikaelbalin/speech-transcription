//! Global shortcut registration for toggling dictation and pausing.
//!
//! On Linux, global shortcuts are captured by reading the physical keyboard
//! via `evdev` (see [`crate::keyboard_listener`]), because
//! `tauri-plugin-global-shortcut` only works over X11 and fails silently on
//! Wayland. On other platforms the plugin is used directly.
//!
//! The shortcuts are read from settings; re-register after a settings change.

#[cfg(target_os = "linux")]
mod linux {
    use std::sync::Mutex;

    use tauri::AppHandle;

    use crate::keyboard_listener::{self, ListenerState};

    /// The running listener, if any. Kept so the active shortcut can be updated
    /// or the listener torn down on re-registration.
    static LISTENER: Mutex<Option<ListenerState>> = Mutex::new(None);

    /// Registers the Linux `evdev` listener for the given shortcuts.
    pub fn register(app: &AppHandle, shortcut: &str, pause_shortcut: &str) -> Result<(), String> {
        let mut guard = LISTENER.lock().unwrap();
        match guard.as_ref() {
            Some(state) => {
                state.set_shortcut(shortcut);
                state.set_pause_shortcut(pause_shortcut);
            }
            None => {
                let state = keyboard_listener::start(app.clone(), shortcut, pause_shortcut);
                *guard = Some(state);
            }
        }
        Ok(())
    }

    /// Unregisters the current listener (used before re-registering on change).
    pub fn unregister(
        _app: &AppHandle,
        _shortcut: &str,
        _pause_shortcut: &str,
    ) -> Result<(), String> {
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

    pub fn register(app: &AppHandle, shortcut: &str, pause_shortcut: &str) -> Result<(), String> {
        register_one(app, shortcut, true)?;
        register_one(app, pause_shortcut, false)?;
        Ok(())
    }

    pub fn unregister(app: &AppHandle, shortcut: &str, pause_shortcut: &str) -> Result<(), String> {
        unregister_one(app, shortcut)?;
        unregister_one(app, pause_shortcut)?;
        Ok(())
    }

    fn register_one(app: &AppHandle, shortcut: &str, is_dictation: bool) -> Result<(), String> {
        let parsed: Shortcut = shortcut
            .parse()
            .map_err(|e| format!("Invalid shortcut '{shortcut}': {e}"))?;

        app.global_shortcut()
            .on_shortcut(parsed, move |app_handle, _scut, event| match event.state {
                ShortcutState::Pressed => {
                    if is_dictation {
                        let _ = app_handle.emit("dictation-pressed", ());
                    } else {
                        let _ = app_handle.emit("pause-pressed", ());
                    }
                }
                ShortcutState::Released => {
                    if is_dictation {
                        let _ = app_handle.emit("dictation-released", ());
                    } else {
                        let _ = app_handle.emit("pause-released", ());
                    }
                }
            })
            .map_err(|e| format!("Failed to register shortcut '{shortcut}': {e}"))?;

        Ok(())
    }

    fn unregister_one(app: &AppHandle, shortcut: &str) -> Result<(), String> {
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
