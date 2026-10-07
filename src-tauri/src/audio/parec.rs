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
}

impl ParecRecorder {
    /// Spawns `parec` and returns a recorder reading from its stdout.
    ///
    /// `device_id` selects a specific source (PulseAudio source name); empty
    /// means the default source.
    pub fn start(sample_rate: u32, device_id: &str) -> Result<Self, String> {
        let mut cmd = Command::new("parec");
        cmd.args([
            "--format=s16le",
            &format!("--rate={sample_rate}"),
            "--channels=1",
            "--latency-msec=100",
        ]);
        if !device_id.is_empty() {
            cmd.arg(format!("--device={device_id}"));
        }
        let child = cmd
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn parec: {e}"))?;

        Ok(Self { child })
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
