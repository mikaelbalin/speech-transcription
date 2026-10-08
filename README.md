# speech-transcription

Real-time speech-to-text desktop app. Press a global shortcut, dictate, and the transcription is pasted into the focused field. Built with [Tauri 2](https://tauri.app/), React 19, Vite, and Tailwind CSS; transcription uses the [Mistral](https://mistral.ai) realtime API.

## Prerequisites

- [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/) toolchain.
- Tauri system dependencies (`webkit2gtk`, etc.) — see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).
- On Linux/Wayland: `pkexec` (PolicyKit) for the auto-paste setup step (see below).

## Install

```sh
pnpm install
```

## Development

```sh
pnpm tauri dev
```

This compiles the Rust backend and serves the frontend from `http://localhost:1420` (Vite, hot reload). Use `pnpm dev` alone if you only
want the frontend in a browser.

> Note: the frontend-only `pnpm dev` has no Tauri APIs, so the Rust commands (audio, transcription, setup) are unavailable.

## Building

```sh
pnpm build:appimage
```

This runs the frontend build (`tsc && vite build`) and produces an AppImage in `src-tauri/target/release/bundle/appimage/`. The app bundles as an AppImage only (`bundle.targets` in `src-tauri/tauri.conf.json`).

## Linux/Wayland: system changes

On Linux the app pastes transcription using a **uinput virtual keyboard**, because Wayland blocks synthetic `Ctrl+V` keystrokes from other apps. Two system-level things are required and are applied by the app's first-run onboarding (or manually via the scripts below):

1. **Write access to `/dev/uinput`** — on modern systemd desktops this is already granted to the active user via logind's `uaccess` ACL; no group change needed.
2. **A udev rule** (`/etc/udev/rules.d/99-speech-transcription.rules`) that assigns the virtual keyboard to `seat0`. uinput devices have no physical path, so udev cannot derive `ID_SEAT` and libinput/KWin would otherwise ignore them.

### In development

The dev scripts mirror what the installer/onboarding does, so you can toggle the
udev rule from the terminal:

```sh
# Install the rule (requires sudo/pkexec) — enables auto-paste
sudo scripts/dev-udev-enable.sh

# Remove the rule and reload udev — reverts the change
sudo scripts/dev-udev-disable.sh
```

### What changes, and how to revert

| Change                          | Where                              | Revert                                         |
| ------------------------------- | ---------------------------------- | ---------------------------------------------- |
| udev rule `99-speech-transcription.rules` | `/etc/udev/rules.d/` | `sudo scripts/dev-udev-disable.sh` (or `revert_setup` in-app) |

The rule is the only persistent system change. `/dev/uinput` access is normally
granted automatically by logind and is not modified. If you ever add a user to
the `input` group manually, that persists until removed.
