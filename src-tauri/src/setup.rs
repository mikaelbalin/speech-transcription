//! Host-level setup for auto-paste on Linux Wayland.
//!
//! Sending synthetic keystrokes (Ctrl+V) from another app is blocked on Wayland.
//! The only universal workaround is `uinput` — a kernel-level virtual input
//! device. Two things are required for it to work:
//!
//!   1. Write access to `/dev/uinput`. On modern systemd desktops this is granted
//!      to the active session user via the `uaccess` mechanism (an ACL from
//!      systemd-logind), so no group membership is required.
//!   2. A udev rule assigning our virtual keyboard to `seat0`, otherwise
//!      libinput/KWin ignores it (uinput devices have no physical path, so udev
//!      cannot derive `ID_SEAT`).
//!
//! The udev rule needs root, so it is applied by a helper script run through
//! `pkexec` (PolicyKit), which shows the user a native password prompt. This
//! mirrors the dev scripts `scripts/dev-udev-enable.sh` / `dev-udev-disable.sh`,
//! but is driven from the app's first-run onboarding screen rather than the
//! terminal.

use std::process::Command;

/// udev rule filename written to `/etc/udev/rules.d/`.
const RULE_NAME: &str = "99-speech-transcription.rules";

/// Whether the uinput udev rule is already installed.
fn rule_installed() -> bool {
    std::path::Path::new("/etc/udev/rules.d")
        .join(RULE_NAME)
        .exists()
}

/// Whether the current process can open `/dev/uinput` for writing.
///
/// This is the actual requirement for auto-paste: the app must be able to
/// create a uinput device. We test it directly rather than checking group
/// membership, because on modern systemd desktops access is granted via the
/// `uaccess` mechanism (an ACL from systemd-logind), not via the `input` group.
/// Depending on the `input` group is both unreliable (on Fedora it is a
/// systemd-managed system group) and unnecessary.
fn can_write_uinput() -> bool {
    std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open("/dev/uinput")
        .is_ok()
}

/// Result of the host setup check, returned to the frontend.
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    /// The udev rule is installed.
    pub rule_installed: bool,
    /// The current process can open `/dev/uinput` for writing.
    pub uinput_writable: bool,
    /// Whether `/dev/uinput` is present at all.
    pub uinput_available: bool,
}

impl SetupStatus {
    pub fn check() -> Self {
        let uinput_available = std::path::Path::new("/dev/uinput").exists();
        Self {
            rule_installed: rule_installed(),
            uinput_writable: uinput_available && can_write_uinput(),
            uinput_available,
        }
    }
}

/// Embedded helper script executed as root via `pkexec`.
///
/// It is written to a temporary file and invoked as
/// `pkexec <path> [enable|disable]`. `pkexec` uses the default PolicyKit action
/// (`org.freedesktop.policykit.exec`), prompting for the administrator password.
const HELPER_SCRIPT: &str = r#"#!/usr/bin/env bash
set -euo pipefail

RULE_NAME="99-speech-transcription.rules"
RULE_PATH="/etc/udev/rules.d/${RULE_NAME}"

case "${1:-}" in
  enable)
    cat > "${RULE_PATH}" <<'EOF'
ACTION=="remove", GOTO="speech_transcription_end"

SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="speech-transcription", \
  ENV{ID_SEAT}="seat0", TAG+="seat", TAG+="uaccess"

LABEL="speech_transcription_end"
EOF
    udevadm control --reload-rules
    udevadm trigger --subsystem-match=input
    ;;
  disable)
    rm -f "${RULE_PATH}"
    udevadm control --reload-rules
    udevadm trigger --subsystem-match=input
    ;;
  *)
    echo "Usage: $0 [enable|disable]" >&2
    exit 2
    ;;
esac
"#;

/// Runs the helper script under `pkexec` with the given action.
///
/// `pkexec` will prompt for credentials via the system PolicyKit agent (the
/// password dialog the user sees). The action is `enable` or `disable`.
fn run_helper(action: &str) -> Result<(), String> {
    // Write the helper to a temp file owned by the current user, so pkexec can
    // read and execute it.
    let dir = std::env::temp_dir().join("speech-transcription-setup");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let script_path = dir.join("setup-helper.sh");
    std::fs::write(&script_path, HELPER_SCRIPT).map_err(|e| e.to_string())?;

    // Ensure executable.
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(&script_path)
        .map_err(|e| e.to_string())?
        .permissions();
    perms.set_mode(0o700);
    std::fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("pkexec");
    cmd.arg(&script_path).arg(action);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run pkexec: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        // pkexec returns 126/127 on auth cancel; surface a friendly message.
        if output.status.code() == Some(126) || output.status.code() == Some(127) {
            Err("Authentication was cancelled or failed.".to_string())
        } else if detail.is_empty() {
            Err(format!(
                "Setup failed (exit code {:?}).",
                output.status.code()
            ))
        } else {
            Err(detail)
        }
    }
}

/// Installs the udev rule and adds the user to the `input` group.
pub fn enable() -> Result<(), String> {
    run_helper("enable")
}

/// Removes the udev rule (group membership is intentionally left intact; group
/// changes require a re-login to take effect and are non-destructive).
pub fn disable() -> Result<(), String> {
    run_helper("disable")
}
