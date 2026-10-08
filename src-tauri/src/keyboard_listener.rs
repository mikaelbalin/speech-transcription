//! Global shortcut listener for Linux via `evdev`.
//!
//! `tauri-plugin-global-shortcut` (and the `global-hotkey` crate it uses) only
//! registers shortcuts through X11 (`XGrabKey`) on Linux. On Wayland there is
//! no equivalent grab, so the shortcut silently stops working. This module
//! replaces that mechanism on Linux with the same approach used by the
//! stream-deck app: read the *physical* keyboard's `/dev/input/event*` devices
//! and match the configured shortcut against the raw key events. Because it
//! reads events at the kernel level it works identically on X11 and Wayland.
//!
//! A background thread:
//!   1. Enumerates physical keyboards (devices that report `KEY_A`).
//!   2. Reads key events, tracking the held state of the four modifiers.
//!   3. When the shortcut's modifiers are held and its main key is pressed,
//!      emits a single `toggle-dictation` event (and does not repeat until the
//!      key is released and pressed again).
//!   4. Re-scans devices periodically to tolerate hotplug, and rebuilds its
//!      target whenever the configured shortcut changes.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use evdev::{Device, EventSummary, KeyCode};
use tauri::{AppHandle, Emitter};

/// DOM `KeyboardEvent.code`-style token (lowercased) → evdev key code.
///
/// This mirrors `stream-deck/src-tauri/src/bindings.rs` `code_to_key_code`, but
/// matches the lowercased tokens the frontend shortcut recorder produces
/// (`event.code.toLowerCase()`), e.g. `"space"`, `"keya"`, `"digit1"`,
/// `"arrowup"`, `"f13"`, `"minus"`, etc.
fn code_to_key_code(code: &str) -> Option<KeyCode> {
    Some(match code {
        // Letters
        "keya" => KeyCode::KEY_A,
        "keyb" => KeyCode::KEY_B,
        "keyc" => KeyCode::KEY_C,
        "keyd" => KeyCode::KEY_D,
        "keye" => KeyCode::KEY_E,
        "keyf" => KeyCode::KEY_F,
        "keyg" => KeyCode::KEY_G,
        "keyh" => KeyCode::KEY_H,
        "keyi" => KeyCode::KEY_I,
        "keyj" => KeyCode::KEY_J,
        "keyk" => KeyCode::KEY_K,
        "keyl" => KeyCode::KEY_L,
        "keym" => KeyCode::KEY_M,
        "keyn" => KeyCode::KEY_N,
        "keyo" => KeyCode::KEY_O,
        "keyp" => KeyCode::KEY_P,
        "keyq" => KeyCode::KEY_Q,
        "keyr" => KeyCode::KEY_R,
        "keys" => KeyCode::KEY_S,
        "keyt" => KeyCode::KEY_T,
        "keyu" => KeyCode::KEY_U,
        "keyv" => KeyCode::KEY_V,
        "keyw" => KeyCode::KEY_W,
        "keyx" => KeyCode::KEY_X,
        "keyy" => KeyCode::KEY_Y,
        "keyz" => KeyCode::KEY_Z,
        // Numbers
        "digit0" => KeyCode::KEY_0,
        "digit1" => KeyCode::KEY_1,
        "digit2" => KeyCode::KEY_2,
        "digit3" => KeyCode::KEY_3,
        "digit4" => KeyCode::KEY_4,
        "digit5" => KeyCode::KEY_5,
        "digit6" => KeyCode::KEY_6,
        "digit7" => KeyCode::KEY_7,
        "digit8" => KeyCode::KEY_8,
        "digit9" => KeyCode::KEY_9,
        // Function keys
        "f1" => KeyCode::KEY_F1,
        "f2" => KeyCode::KEY_F2,
        "f3" => KeyCode::KEY_F3,
        "f4" => KeyCode::KEY_F4,
        "f5" => KeyCode::KEY_F5,
        "f6" => KeyCode::KEY_F6,
        "f7" => KeyCode::KEY_F7,
        "f8" => KeyCode::KEY_F8,
        "f9" => KeyCode::KEY_F9,
        "f10" => KeyCode::KEY_F10,
        "f11" => KeyCode::KEY_F11,
        "f12" => KeyCode::KEY_F12,
        "f13" => KeyCode::KEY_F13,
        "f14" => KeyCode::KEY_F14,
        "f15" => KeyCode::KEY_F15,
        "f16" => KeyCode::KEY_F16,
        "f17" => KeyCode::KEY_F17,
        "f18" => KeyCode::KEY_F18,
        "f19" => KeyCode::KEY_F19,
        "f20" => KeyCode::KEY_F20,
        "f21" => KeyCode::KEY_F21,
        "f22" => KeyCode::KEY_F22,
        "f23" => KeyCode::KEY_F23,
        "f24" => KeyCode::KEY_F24,
        // Navigation / editing
        "space" => KeyCode::KEY_SPACE,
        "enter" => KeyCode::KEY_ENTER,
        "tab" => KeyCode::KEY_TAB,
        "escape" => KeyCode::KEY_ESC,
        "backspace" => KeyCode::KEY_BACKSPACE,
        "delete" => KeyCode::KEY_DELETE,
        "insert" => KeyCode::KEY_INSERT,
        "home" => KeyCode::KEY_HOME,
        "end" => KeyCode::KEY_END,
        "pageup" => KeyCode::KEY_PAGEUP,
        "pagedown" => KeyCode::KEY_PAGEDOWN,
        "arrowup" => KeyCode::KEY_UP,
        "arrowdown" => KeyCode::KEY_DOWN,
        "arrowleft" => KeyCode::KEY_LEFT,
        "arrowright" => KeyCode::KEY_RIGHT,
        // Media
        "mediaplaypause" => KeyCode::KEY_PLAYPAUSE,
        "mediatracknext" => KeyCode::KEY_NEXTSONG,
        "mediatrackprevious" => KeyCode::KEY_PREVIOUSSONG,
        "mediastop" => KeyCode::KEY_STOPCD,
        "audiovolumeup" => KeyCode::KEY_VOLUMEUP,
        "audiovolumedown" => KeyCode::KEY_VOLUMEDOWN,
        "audiovolumemute" => KeyCode::KEY_MUTE,
        // Punctuation
        "minus" => KeyCode::KEY_MINUS,
        "equal" => KeyCode::KEY_EQUAL,
        "bracketleft" => KeyCode::KEY_LEFTBRACE,
        "bracketright" => KeyCode::KEY_RIGHTBRACE,
        "semicolon" => KeyCode::KEY_SEMICOLON,
        "quote" => KeyCode::KEY_APOSTROPHE,
        "backquote" => KeyCode::KEY_GRAVE,
        "backslash" => KeyCode::KEY_BACKSLASH,
        "comma" => KeyCode::KEY_COMMA,
        "period" => KeyCode::KEY_DOT,
        "slash" => KeyCode::KEY_SLASH,
        _ => return None,
    })
}

/// A parsed shortcut: the required modifiers plus the main (non-modifier) key.
#[derive(Clone)]
struct Target {
    ctrl: bool,
    shift: bool,
    alt: bool,
    meta: bool,
    key: KeyCode,
}

/// Parses a shortcut string such as `"ctrl+alt+space"` into a [`Target`].
///
/// The frontend stores modifiers in the order `ctrl`, `shift`, `alt`, `super`
/// (see `use-shortcut-recorder.ts`), followed by the lowercased DOM code.
fn parse_shortcut(shortcut: &str) -> Option<Target> {
    let mut ctrl = false;
    let mut shift = false;
    let mut alt = false;
    let mut meta = false;
    let mut key = None;

    for token in shortcut
        .split('+')
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
    {
        match token.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => ctrl = true,
            "shift" => shift = true,
            "alt" | "option" => alt = true,
            "meta" | "super" | "cmd" | "command" | "win" => meta = true,
            other => key = code_to_key_code(other),
        }
    }

    let key = key?;
    // A bare modifier-only shortcut is meaningless; require a real key.
    if !ctrl && !shift && !alt && !meta {
        return None;
    }

    Some(Target {
        ctrl,
        shift,
        alt,
        meta,
        key,
    })
}

/// A physical keyboard device that we poll for key events.
struct KeyboardDevice {
    device: Device,
}

/// Detects whether an evdev device is a physical keyboard we should listen to.
///
/// We require the device to report `KEY_A`. This excludes mice, touchpads,
/// power buttons, and virtual devices that only expose a handful of keys. We
/// also skip our own `uinput` virtual keyboard (used for auto-paste) by name, so
/// the listener never reacts to keystrokes the app emits itself.
fn is_keyboard(device: &Device) -> bool {
    if !device
        .supported_keys()
        .map(|keys| keys.contains(KeyCode::KEY_A))
        .unwrap_or(false)
    {
        return false;
    }

    let name = device.name().unwrap_or_default();
    if name == "speech-transcription" {
        return false;
    }

    true
}

/// Enumerates the physical keyboards currently attached.
fn enumerate_keyboards() -> Vec<KeyboardDevice> {
    evdev::enumerate()
        .filter_map(|(path, device)| {
            if is_keyboard(&device) {
                // Re-open by path to own the fd for reading, and put it in
                // non-blocking mode so `fetch_events` returns immediately when
                // there is nothing pending (otherwise a single idle device —
                // e.g. the pedal, which is enumerated first — would block the
                // whole loop and starve the real keyboard).
                match Device::open(&path) {
                    Ok(d) => {
                        if d.set_nonblocking(true).is_err() {
                            return None;
                        }
                        Some(KeyboardDevice { device: d })
                    }
                    Err(_) => None,
                }
            } else {
                None
            }
        })
        .collect()
}

/// Whether the given modifier set matches the target's modifiers.
fn modifiers_match(state: &ModifierState, target: &Target) -> bool {
    state.ctrl == target.ctrl
        && state.shift == target.shift
        && state.alt == target.alt
        && state.meta == target.meta
}

/// The currently-held state of the four modifier keys.
#[derive(Default, Clone)]
struct ModifierState {
    ctrl: bool,
    shift: bool,
    alt: bool,
    meta: bool,
}

impl ModifierState {
    /// Updates the held state from a modifier key event. Returns true if the
    /// key is a modifier (and was consumed).
    fn apply(&mut self, code: KeyCode, value: i32) -> bool {
        let pressed = value != 0;
        match code {
            KeyCode::KEY_LEFTCTRL | KeyCode::KEY_RIGHTCTRL => {
                self.ctrl = pressed;
                true
            }
            KeyCode::KEY_LEFTSHIFT | KeyCode::KEY_RIGHTSHIFT => {
                self.shift = pressed;
                true
            }
            KeyCode::KEY_LEFTALT | KeyCode::KEY_RIGHTALT => {
                self.alt = pressed;
                true
            }
            KeyCode::KEY_LEFTMETA | KeyCode::KEY_RIGHTMETA => {
                self.meta = pressed;
                true
            }
            _ => false,
        }
    }
}

/// Message sent from the settings thread to the listener thread.
enum Command {
    /// Replace the active shortcut target (empty string = disabled).
    Update(String),
    /// Stop the listener thread.
    Shutdown,
}

/// The shared, hot-swappable shortcut target.
pub struct ListenerState {
    sender: Sender<Command>,
}

impl ListenerState {
    /// Requests a shortcut change. Safe to call from any thread.
    pub fn set_shortcut(&self, shortcut: &str) {
        let _ = self.sender.send(Command::Update(shortcut.to_string()));
    }

    /// Stops the listener thread.
    pub fn shutdown(&self) {
        let _ = self.sender.send(Command::Shutdown);
    }
}

/// Starts the Linux keyboard listener and returns a handle used to update or
/// stop it. The listener runs on its own thread and emits `toggle-dictation`
/// through the Tauri `AppHandle`.
pub fn start(app: AppHandle, shortcut: &str) -> ListenerState {
    let (sender, receiver): (Sender<Command>, Receiver<Command>) = channel();

    let target = Arc::new(Mutex::new(parse_shortcut(shortcut)));
    let target_clone = Arc::clone(&target);

    let listener_state = ListenerState {
        sender: sender.clone(),
    };

    thread::spawn(move || {
        listener_loop(app, receiver, target_clone);
    });

    listener_state
}

/// The main listener loop.
fn listener_loop(app: AppHandle, receiver: Receiver<Command>, target: Arc<Mutex<Option<Target>>>) {
    let mut devices: Vec<KeyboardDevice> = Vec::new();
    let mut state = ModifierState::default();
    // True once the shortcut has fired and is waiting for the main key release.
    let fired = AtomicBool::new(false);

    // Re-scan devices every few seconds to pick up hotplugged keyboards.
    let rescan = Duration::from_secs(5);
    let mut last_scan = std::time::Instant::now() - rescan;

    loop {
        // Process any pending commands (shortcut updates / shutdown).
        while let Ok(cmd) = receiver.try_recv() {
            match cmd {
                Command::Update(shortcut) => {
                    let mut guard = target.lock().unwrap();
                    *guard = parse_shortcut(&shortcut);
                    fired.store(false, Ordering::SeqCst);
                }
                Command::Shutdown => return,
            }
        }

        // Periodically refresh the device list (and on first iteration).
        if last_scan.elapsed() >= rescan {
            devices = enumerate_keyboards();
            last_scan = std::time::Instant::now();
        }

        for kbd in devices.iter_mut() {
            let events = match kbd.device.fetch_events() {
                Ok(e) => e,
                Err(_) => continue,
            };

            for event in events {
                if let EventSummary::Key(_, code, value) = event.destructure() {
                    // Modifiers update the shared held-state.
                    if state.apply(code, value) {
                        continue;
                    }

                    let current = target.lock().unwrap().clone();
                    let Some(target) = current else {
                        continue;
                    };

                    // Only the main key matters here (modifiers already tracked).
                    if code != target.key {
                        continue;
                    }

                    if value == 0 {
                        // Released: re-arm for the next press.
                        fired.store(false, Ordering::SeqCst);
                    } else if !fired.swap(true, Ordering::SeqCst)
                        && modifiers_match(&state, &target)
                    {
                        let _ = app.emit("toggle-dictation", ());
                    }
                }
            }
        }

        // `fetch_events` is non-blocking, so a short sleep keeps this loop from
        // busy-spinning when there is nothing to read.
        thread::sleep(Duration::from_millis(10));
    }
}
