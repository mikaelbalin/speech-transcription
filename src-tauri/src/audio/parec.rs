use std::io::Read;
use std::process::{Child, Command, Stdio};

use super::{AudioChunk, AudioSource};

/// Chunk size read from `parec` stdout per call, in bytes.
/// At 16 kHz mono s16le this is ~40 ms of audio per chunk.
const READ_BUF_SIZE: usize = 640;

/// Linux microphone capture via the `parec` (PulseAudio/PipeWire) CLI.
///
/// Spawns `parec --format=s16le --rate=<rate> --channels=1` and reads raw PCM
/// from its stdout. Mirrors the approach used by the reference `packages/audio`
/// service.
pub struct ParecRecorder {
    child: Child,
    sample_rate: u32,
}

impl ParecRecorder {
    /// Spawns `parec` and returns a recorder reading from its stdout.
    pub fn start(sample_rate: u32) -> Result<Self, String> {
        let child = Command::new("parec")
            .args([
                "--format=s16le",
                &format!("--rate={sample_rate}"),
                "--channels=1",
                "--latency-msec=100",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn parec: {e}"))?;

        Ok(Self { child, sample_rate })
    }

    /// The sample rate this recorder produces audio at.
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
}

impl AudioSource for ParecRecorder {
    fn next_chunk(&mut self) -> Option<AudioChunk> {
        let stdout = self.child.stdout.as_mut()?;
        let mut buf = vec![0u8; READ_BUF_SIZE];
        match stdout.read(&mut buf) {
            Ok(0) => None,
            Ok(n) => {
                buf.truncate(n);
                Some(buf)
            }
            Err(_) => None,
        }
    }
}

impl Drop for ParecRecorder {
    fn drop(&mut self) {
        // Best-effort stop; ignore errors (process may already be gone).
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
