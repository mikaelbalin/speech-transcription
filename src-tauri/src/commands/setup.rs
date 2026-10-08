use crate::setup::{self, SetupStatus};

/// Returns the current host-setup status (udev rule, /dev/uinput write
/// access, and whether /dev/uinput exists).
#[tauri::command]
pub fn check_setup_status() -> SetupStatus {
    SetupStatus::check()
}

/// Runs the host setup (installs the udev rule + adds user to `input` group)
/// via a `pkexec` password prompt.
#[tauri::command]
pub fn run_setup() -> Result<(), String> {
    setup::enable()
}

/// Reverts the host setup (removes the udev rule) via a `pkexec` password prompt.
#[tauri::command]
pub fn revert_setup() -> Result<(), String> {
    setup::disable()
}
