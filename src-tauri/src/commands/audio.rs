use serde::Serialize;

/// A single input (microphone) device, exposed to the frontend for selection.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDevice {
    /// Stable identifier (implementation-defined).
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Whether this is the system default.
    pub is_default: bool,
}

/// Lists available input (microphone) devices.
#[tauri::command]
pub fn get_devices() -> Result<Vec<InputDevice>, String> {
    crate::audio::list_input_devices()
}
