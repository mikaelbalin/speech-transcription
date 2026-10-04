pub mod audio;
pub mod settings;
pub mod transcription;

pub use audio::get_devices;
pub use settings::{get_settings, set_settings};
pub use transcription::{start_transcription, stop_transcription};
