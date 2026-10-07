use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "settings.json";

/// Default model for realtime transcription.
const DEFAULT_MODEL: &str = "voxtral-mini-transcribe-realtime-2602";
const DEFAULT_BASE_URL: &str = "wss://api.mistral.ai";
const DEFAULT_SAMPLE_RATE: u32 = 16000;
const DEFAULT_SHORTCUT: &str = "ctrl+alt+space";

/// Application settings persisted via the Tauri store plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Mistral API key.
    pub api_key: String,
    /// Realtime transcription model id.
    pub model: String,
    /// Audio sample rate in Hz.
    pub sample_rate: u32,
    /// Optional target streaming delay in ms (None = Mistral default).
    pub target_delay_ms: Option<u32>,
    /// Global shortcut that toggles dictation.
    pub shortcut: String,
    /// Base WebSocket URL of the Mistral API.
    pub base_url: String,
    /// Selected input (microphone) device id. Empty = system default.
    pub input_device_id: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: DEFAULT_MODEL.to_string(),
            sample_rate: DEFAULT_SAMPLE_RATE,
            target_delay_ms: None,
            shortcut: DEFAULT_SHORTCUT.to_string(),
            base_url: DEFAULT_BASE_URL.to_string(),
            input_device_id: String::new(),
        }
    }
}

/// Read settings from the store, falling back to defaults for missing keys.
pub fn get_settings(app: &AppHandle) -> AppSettings {
    let store = app.store(STORE_PATH).ok();

    let read = |key: &str| -> Option<serde_json::Value> { store.as_ref().and_then(|s| s.get(key)) };

    let get_str = |key: &str, default: &str| -> String {
        read(key)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| default.to_string())
    };

    let get_u32 = |key: &str, default: u32| -> u32 {
        read(key)
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(default)
    };

    AppSettings {
        api_key: get_str("api_key", ""),
        model: get_str("model", DEFAULT_MODEL),
        sample_rate: get_u32("sample_rate", DEFAULT_SAMPLE_RATE),
        target_delay_ms: read("target_delay_ms")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32),
        shortcut: get_str("shortcut", DEFAULT_SHORTCUT),
        base_url: get_str("base_url", DEFAULT_BASE_URL),
        input_device_id: get_str("input_device_id", ""),
    }
}

/// Persist settings to the store. `set` triggers auto-save on each key, so an
/// explicit `save` is not required.
pub fn set_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;

    store.set("api_key", settings.api_key.clone());
    store.set("model", settings.model.clone());
    store.set("sample_rate", settings.sample_rate);
    match settings.target_delay_ms {
        Some(ms) => store.set("target_delay_ms", ms),
        None => {
            store.delete("target_delay_ms");
        }
    }
    store.set("shortcut", settings.shortcut.clone());
    store.set("base_url", settings.base_url.clone());
    store.set("input_device_id", settings.input_device_id.clone());

    Ok(())
}
