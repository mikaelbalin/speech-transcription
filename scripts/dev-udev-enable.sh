#!/usr/bin/env bash
# Development-time helper: install the udev rule that assigns our uinput
# keyboard to seat0, so libinput/KWin (KDE Wayland) actually picks it up.
#
# WHY: uinput devices have no physical path, so udev's `path_id` cannot derive
# ID_PATH_TAG -> ID_SEAT. libinput is created for seat0 and ignores any input
# device without ID_SEAT. Without this rule, paste via uinput does nothing on
# Wayland (the device is created but never read by the compositor).
#
# This writes to /etc/udev/rules.d/ (requires root/sudo). It is the same rule
# the installer applies at package-install time; this script only exists to
# reproduce it during development. The companion dev-udev-disable.sh reverts it.
set -euo pipefail

RULE_NAME="99-speech-transcription.rules"
RULE_PATH="/etc/udev/rules.d/${RULE_NAME}"

if [ "${EUID}" -ne 0 ] && ! sudo -n true 2>/dev/null; then
  echo "This script needs root. Re-run with sudo:  sudo $0" >&2
  exit 1
fi

run() { if [ "${EUID}" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

cat << 'EOF' | run tee "${RULE_PATH}" > /dev/null
# Assign the speech-transcription uinput keyboard to seat0 so libinput/KWin
# picks it up (uinput devices have no physical path, so ID_SEAT is never set).
ACTION=="remove", GOTO="speech_transcription_end"

SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="speech-transcription", \
  ENV{ID_SEAT}="seat0", TAG+="seat", TAG+="uaccess"

LABEL="speech_transcription_end"
EOF

run udevadm control --reload-rules
run udevadm trigger --subsystem-match=input

echo "Installed ${RULE_PATH} and reloaded udev."
echo "Re-test paste now. To revert: scripts/dev-udev-disable.sh"
