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

/// Starts capture. `device_id` selects a specific input device; empty means
/// the system default.
pub fn start_recorder(sample_rate: u32, device_id: &str) -> Result<Recorder, String> {
    Recorder::start(sample_rate, device_id)
}

#[cfg(target_os = "linux")]
fn list_input_devices_parec() -> Result<Vec<InputDevice>, String> {
    use std::process::Command;

    let out = Command::new("pactl")
        .args(["list", "sources"])
        .output()
        .map_err(|e| format!("Failed to run pactl: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);

    let default_source = Command::new("pactl")
        .args(["get-default-source"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let mut devices = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_description: Option<String> = None;

    let flush = |name: &Option<String>,
                 description: &Option<String>,
                 devices: &mut Vec<InputDevice>,
                 default_source: &Option<String>| {
        let Some(name) = name.clone() else { return };
        // Skip monitor sources (loopback of outputs, not microphones).
        if name.ends_with(".monitor") {
            return;
        }
        let label = description
            .clone()
            .filter(|d| !d.trim().is_empty())
            .unwrap_or_else(|| name.clone());
        devices.push(InputDevice {
            id: name.clone(),
            name: label,
            is_default: default_source.as_deref() == Some(name.as_str()),
        });
    };

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("Name:") {
            flush(
                &current_name,
                &current_description,
                &mut devices,
                &default_source,
            );
            current_name = Some(rest.trim().to_string());
            current_description = None;
        } else if let Some(rest) = trimmed.strip_prefix("Description:") {
            current_description = Some(rest.trim().to_string());
        }
    }
    flush(
        &current_name,
        &current_description,
        &mut devices,
        &default_source,
    );

    // Fallback: if no default was matched, mark the first source as default.
    if !devices.iter().any(|d| d.is_default) {
        if let Some(first) = devices.first_mut() {
            first.is_default = true;
        }
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
