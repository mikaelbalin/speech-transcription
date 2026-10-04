use crate::commands::audio::InputDevice;

/// Captures microphone audio as a stream of `pcm_s16le` mono chunks.
///
/// Linux uses `parec` (PulseAudio/PipeWire); other platforms use `cpal`.
/// This module only exposes a unified interface — the platform implementation
/// lives in `parec.rs` / `cpal.rs`.

#[cfg(target_os = "linux")]
mod parec;
#[cfg(target_os = "linux")]
pub use parec::ParecRecorder as Recorder;

#[cfg(not(target_os = "linux"))]
mod cpal_impl;
#[cfg(not(target_os = "linux"))]
pub use cpal_impl::CpalRecorder as Recorder;

/// A single captured audio chunk (raw `pcm_s16le` bytes, mono).
pub type AudioChunk = Vec<u8>;

/// Common trait for platform audio recorders.
pub trait AudioSource {
    /// Returns the next chunk of raw PCM bytes, or `None` once the stream ends.
    fn next_chunk(&mut self) -> Option<AudioChunk>;
}

/// Lists available input (microphone) devices.
pub fn list_input_devices() -> Result<Vec<InputDevice>, String> {
    #[cfg(target_os = "linux")]
    {
        list_input_devices_parec()
    }
    #[cfg(not(target_os = "linux"))]
    {
        list_input_devices_cpal()
    }
}

#[cfg(target_os = "linux")]
fn list_input_devices_parec() -> Result<Vec<InputDevice>, String> {
    use std::process::Command;

    let out = Command::new("pactl")
        .args(["list", "short", "sources"])
        .output()
        .map_err(|e| format!("Failed to run pactl: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);

    let mut devices = Vec::new();
    for line in text.lines() {
        // Format: <index>\t<name>\t<driver>\t<sample_spec>\t<state>
        let mut cols = line.split('\t');
        let Some(index) = cols.next() else { continue };
        let Some(name) = cols.next() else { continue };
        if name.trim().is_empty() {
            continue;
        }
        devices.push(InputDevice {
            id: index.trim().to_string(),
            name: name.trim().to_string(),
            is_default: false,
        });
    }

    // Best-effort: mark the first source as default.
    if let Some(first) = devices.first_mut() {
        first.is_default = true;
    }

    Ok(devices)
}

#[cfg(not(target_os = "linux"))]
fn list_input_devices_cpal() -> Result<Vec<InputDevice>, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut devices = Vec::new();
    if let Ok(list) = host.input_devices() {
        for (i, device) in list.enumerate() {
            let name = device.name().unwrap_or_else(|_| "Unknown".to_string());
            devices.push(InputDevice {
                id: i.to_string(),
                is_default: Some(name.clone()) == default_name,
                name,
            });
        }
    }
    Ok(devices)
}
