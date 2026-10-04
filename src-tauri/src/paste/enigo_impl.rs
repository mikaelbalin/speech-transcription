use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::time::Duration;

/// Sends Ctrl+V (Cmd+V on macOS) using `enigo`.
pub fn send_paste() -> Result<(), String> {
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to create Enigo: {e}"))?;

    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    enigo
        .key(modifier, Direction::Press)
        .map_err(|e| format!("Failed to press modifier: {e}"))?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("Failed to click V: {e}"))?;

    std::thread::sleep(Duration::from_millis(100));

    enigo
        .key(modifier, Direction::Release)
        .map_err(|e| format!("Failed to release modifier: {e}"))?;

    Ok(())
}
