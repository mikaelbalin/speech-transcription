#!/usr/bin/env bash
# Development-time helper: remove the udev rule installed by
# dev-udev-enable.sh and reload udev.
#
# This reverts the dev-time seat assignment for our uinput keyboard. The rule
# is identical to what the installer's postrm removes on uninstall.
set -euo pipefail

RULE_NAME="99-speech-transcription.rules"
RULE_PATH="/etc/udev/rules.d/${RULE_NAME}"

if [ "${EUID}" -ne 0 ] && ! sudo -n true 2>/dev/null; then
  echo "This script needs root. Re-run with sudo:  sudo $0" >&2
  exit 1
fi

run() { if [ "${EUID}" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

if [ -f "${RULE_PATH}" ]; then
  run rm -f "${RULE_PATH}"
  run udevadm control --reload-rules
  run udevadm trigger --subsystem-match=input
  echo "Removed ${RULE_PATH} and reloaded udev."
else
  echo "No rule at ${RULE_PATH} — nothing to remove."
fi
