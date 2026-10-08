//! Host-level setup for auto-paste on Linux Wayland.
//!
//! Sending synthetic keystrokes (Ctrl+V) from another app is blocked on Wayland.
//! The only universal workaround is `uinput` — a kernel-level virtual input
//! device. Two things are required for it to work:
//!
//!   1. Write access to `/dev/uinput` (root, or membership in the `input` group).
//!   2. A udev rule assigning our virtual keyboard to `seat0`, otherwise
//!      libinput/KWin ignores it (uinput devices have no physical path, so udev
//!      cannot derive `ID_SEAT`).
//!
//! Both need root, so they are applied by a helper script run through `pkexec`
//! (PolicyKit), which shows the user a native password prompt. This mirrors the
//! dev scripts `scripts/dev-udev-enable.sh` / `dev-udev-disable.sh`, but is
//! driven from the app's first-run onboarding screen rather than the terminal.

use std::process::Command;

/// udev rule filename written to `/etc/udev/rules.d/`.
const RULE_NAME: &str = "99-speech-transcription.rules";

/// Whether the uinput udev rule is already installed.
fn rule_installed() -> bool {
    std::path::Path::new("/etc/udev/rules.d")
        .join(RULE_NAME)
        .exists()
}

/// Whether the current user belongs to the `input` group.
fn in_input_group() -> bool {
    // `id -nG` lists the current user's supplementary group names.
    let Ok(output) = Command::new("id").arg("-nG").output() else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    let names = String::from_utf8_lossy(&output.stdout);
    names.split_whitespace().any(|g| g == "input")
}

/// Result of the host setup check, returned to the frontend.
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    /// The udev rule is installed.
    pub rule_installed: bool,
    /// The user is in the `input` group.
    pub in_input_group: bool,
    /// Whether `/dev/uinput` is present at all.
    pub uinput_available: bool,
}

impl SetupStatus {
    pub fn check() -> Self {
        Self {
            rule_installed: rule_installed(),
            in_input_group: in_input_group(),
            uinput_available: std::path::Path::new("/dev/uinput").exists(),
        }
    }
}

/// Embedded helper script executed as root via `pkexec`.
///
/// It is written to a temporary file and invoked as
/// `pkexec <path> [enable|disable]`. The PolicyKit rule (installed with the app)
/// authorizes `pkexec` for this specific script.
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
    # Add the invoking user (passed as $2 by the caller) to the input group.
    if [ -n "${2:-}" ]; then
      usermod -aG input "${2}"
    fi
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

    // The invoking user (for `usermod -aG input`). pkexec does not set a
    // variable for this, so capture it before elevating.
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_default();

    let mut cmd = Command::new("pkexec");
    cmd.arg(&script_path).arg(action);
    if !username.is_empty() {
        cmd.arg(&username);
    }

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
