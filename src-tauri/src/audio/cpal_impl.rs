use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::mpsc::{self, Receiver};

use super::{AudioChunk, AudioSource};

/// Windows/macOS microphone capture via `cpal`.
///
/// cpal delivers `f32` samples at the device's native rate; we convert to
/// `pcm_s16le` mono and (when needed) resample to the requested rate.
/// Resampling is intentionally simple here (nearest/linear) — Mistral accepts
/// the target rate directly, and we configure cpal to a compatible rate when
/// the device supports it.
pub struct CpalRecorder {
    rx: Receiver<AudioChunk>,
    stream: cpal::Stream,
}

impl CpalRecorder {
    /// Starts capture from the default input device.
    pub fn start(sample_rate: u32) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default input device".to_string())?;

        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get input config: {e}"))?;

        let channels = config.channels() as usize;
        let device_rate = config.sample_rate().0;

        let (tx, rx) = mpsc::channel::<AudioChunk>();

        // Collect into a mono s16le buffer, resampling linearly to target rate.
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => build_stream::<f32>(
                &device,
                &config.into(),
                channels,
                device_rate,
                sample_rate,
                tx,
            )?,
            cpal::SampleFormat::I16 => build_stream::<i16>(
                &device,
                &config.into(),
                channels,
                device_rate,
                sample_rate,
                tx,
            )?,
            cpal::SampleFormat::U16 => build_stream::<u16>(
                &device,
                &config.into(),
                channels,
                device_rate,
                sample_rate,
                tx,
            )?,
            _ => return Err("Unsupported sample format".to_string()),
        };

        stream
            .play()
            .map_err(|e| format!("Failed to play stream: {e}"))?;

        Ok(Self { rx, stream })
    }
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    channels: usize,
    device_rate: u32,
    target_rate: u32,
    tx: mpsc::Sender<AudioChunk>,
) -> Result<cpal::Stream, String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let err_fn = |e| eprintln!("cpal stream error: {e}");

    let stream = device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|frame| frame[0].to_sample::<f32>())
                    .collect();
                let resampled = resample(&mono, device_rate, target_rate);
                let pcm: Vec<u8> = resampled
                    .into_iter()
                    .flat_map(|s| (s as i16).to_le_bytes())
                    .collect();
                let _ = tx.send(pcm);
            },
            err_fn,
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {e}"))?;

    Ok(stream)
}

/// Linear resampling of mono f32 samples to the target rate.
fn resample(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || input.is_empty() {
        return input.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let out_len = (input.len() as f64 / ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src = i as f64 * ratio;
        let idx = src.floor() as usize;
        let frac = src - idx as f64;
        let a = input[idx.min(input.len() - 1)];
        let b = input[(idx + 1).min(input.len() - 1)];
        out.push(a + (b - a) * frac as f32);
    }
    out
}

impl AudioSource for CpalRecorder {
    fn next_chunk(&mut self) -> Option<AudioChunk> {
        self.rx.recv().ok()
    }
}
