use mouse_keyboard_input::key_codes::{KEY_LEFTCTRL, KEY_V};
use mouse_keyboard_input::VirtualDevice;
use std::time::Duration;

/// Sends Ctrl+V using a uinput virtual keyboard (works on Wayland).
///
/// Requires write access to `/dev/uinput` (root or `input` group via a udev
/// rule). Returns an error if the virtual device cannot be created, which the
/// caller treats as "fall back to clipboard-only".
pub fn send_paste() -> Result<(), String> {
    let mut device = VirtualDevice::default().map_err(|e| format!("uinput unavailable: {e}"))?;

    device
        .press(KEY_LEFTCTRL)
        .map_err(|e| format!("Failed to press Ctrl: {e}"))?;
    device
        .click(KEY_V)
        .map_err(|e| format!("Failed to click V: {e}"))?;
    device
        .release(KEY_LEFTCTRL)
        .map_err(|e| format!("Failed to release Ctrl: {e}"))?;

    // Give the compositor a moment to deliver the paste.
    std::thread::sleep(Duration::from_millis(50));

    Ok(())
}
