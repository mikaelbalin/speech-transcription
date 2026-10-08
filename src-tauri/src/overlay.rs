//! Recording overlay window.
//!
//! Shows live transcription text in a small card anchored to the top-center of
//! the screen, above the active application.
//!
//! On Wayland the compositor decides where windows go (and ignores
//! `set_position`), so we use a **small layer surface** (gtk-layer-shell) anchored
//! to the top edge. Unlike a fullscreen transparent layer, a small card only
//! occupies its own area — the rest of the screen is untouched, so it can't
//! swallow clicks meant for the focused application. This is the same approach
//! used by Handy.
//!
//! Fallback: if the compositor doesn't support gtk-layer-shell (e.g. GNOME or
//! X11), the window is shown as a regular always-on-top window.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Logical size of the overlay card.
const OVERLAY_WIDTH: f64 = 320.0;
const OVERLAY_HEIGHT: f64 = 44.0;

/// Margin from the top edge of the screen (logical px).
const OVERLAY_TOP_MARGIN: i32 = 12;

#[cfg(target_os = "linux")]
static LAYER_SHELL_ACTIVE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Creates the overlay window and keeps it hidden until shown.
pub fn create_overlay(app_handle: &AppHandle) {
    let builder = WebviewWindowBuilder::new(
        app_handle,
        "recording_overlay",
        WebviewUrl::App("src/overlay/index.html".into()),
    )
    .title("Recording")
    .resizable(false)
    .inner_size(OVERLAY_WIDTH, OVERLAY_HEIGHT)
    .shadow(false)
    .maximizable(false)
    .minimizable(false)
    .closable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .visible(false);

    match builder.build() {
        Ok(window) => {
            #[cfg(target_os = "linux")]
            {
                if init_gtk_layer_shell(&window) {
                    eprintln!("[overlay] gtk-layer-shell initialized");
                } else {
                    eprintln!("[overlay] gtk-layer-shell unavailable, using fallback window");
                }
            }
        }
        Err(e) => {
            eprintln!("[overlay] failed to create window: {e}");
        }
    }
}

/// Turns the overlay window into a small layer surface anchored to the top edge
/// (Linux/Wayland). Returns true if the layer shell was initialized.
#[cfg(target_os = "linux")]
fn init_gtk_layer_shell(window: &tauri::WebviewWindow) -> bool {
    use gtk::prelude::{GtkWindowExt, WidgetExt};
    use gtk_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};

    if !gtk_layer_shell::is_supported() {
        return false;
    }

    let Ok(gtk_window) = window.gtk_window() else {
        return false;
    };

    gtk_window.init_layer_shell();
    gtk_window.set_layer(Layer::Overlay);
    gtk_window.set_keyboard_mode(KeyboardMode::OnDemand);
    gtk_window.set_exclusive_zone(0);

    // Anchor to the top edge only; center it horizontally with equal left/right
    // margins via GTK alignment. The compositor positions it for us.
    gtk_window.set_anchor(Edge::Top, true);
    gtk_window.set_layer_shell_margin(Edge::Top, OVERLAY_TOP_MARGIN);

    // Layer surfaces size themselves from GTK's size request, not `set_size`.
    // Handy documents the `set_size_request` + `resize(1, 1)` sequence.
    gtk_window.set_size_request(OVERLAY_WIDTH as i32, OVERLAY_HEIGHT as i32);
    gtk_window.resize(1, 1);

    let initialized = gtk_window.is_layer_window();
    LAYER_SHELL_ACTIVE.store(initialized, std::sync::atomic::Ordering::SeqCst);
    initialized
}

/// Emits an event directly to the overlay window's webview.
///
/// The overlay is a separate `focusable(false)` window; targeting it explicitly
/// (rather than broadcasting via `AppHandle::emit`) guarantees delivery even
/// when the event originates from a background thread. No-op if the window
/// handle is unavailable.
pub fn emit_overlay<S: Serialize + Clone>(app_handle: &AppHandle, event: &str, payload: S) {
    if let Some(window) = app_handle.get_webview_window("recording_overlay") {
        let _ = window.emit(event, payload);
    }
}

/// Shows the overlay window.
///
/// GTK is not thread-safe: `show()` must run on the main thread. Callers are
/// usually on a background thread (the transcription session), so we hop to the
/// main thread here.
pub fn show_overlay(app_handle: &AppHandle) {
    let handle = app_handle.clone();
    let _ = app_handle.run_on_main_thread(move || {
        if let Some(window) = handle.get_webview_window("recording_overlay") {
            let _ = window.emit("show-overlay", ());
            let _ = window.show();
        }
    });
}

/// Hides the overlay window.
///
/// GTK is not thread-safe: `hide()` must run on the main thread.
pub fn hide_overlay(app_handle: &AppHandle) {
    let handle = app_handle.clone();
    let _ = app_handle.run_on_main_thread(move || {
        if let Some(window) = handle.get_webview_window("recording_overlay") {
            let _ = window.emit("hide-overlay", ());
            let _ = window.hide();
        }
    });
}
