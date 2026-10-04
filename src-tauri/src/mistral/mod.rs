use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

mod protocol;
pub use protocol::TranscriptionEvent;

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// A connected Mistral realtime transcription session, split into an audio
/// writer and an event reader so they can be driven concurrently.
pub struct MistralSession {
    pub writer: AudioWriter,
    pub reader: EventReader,
}

/// Sends raw PCM audio chunks to Mistral.
pub struct AudioWriter {
    sink: futures_util::stream::SplitSink<Ws, Message>,
}

/// Receives transcription events from Mistral.
pub struct EventReader {
    stream: futures_util::stream::SplitStream<Ws>,
}

impl MistralSession {
    /// Connects to the realtime endpoint and authenticates with the API key.
    pub async fn connect(base_url: &str, api_key: &str, model: &str) -> Result<Self, String> {
        let url = format!("{base_url}/v1/audio/transcriptions/realtime?model={model}");

        let mut request = url
            .into_client_request()
            .map_err(|e| format!("Invalid URL: {e}"))?;
        request.headers_mut().insert(
            "Authorization",
            format!("Bearer {api_key}")
                .parse()
                .map_err(|e| format!("Invalid auth header: {e}"))?,
        );

        let (ws, _) = connect_async(request)
            .await
            .map_err(|e| format!("Failed to connect: {e}"))?;

        let (sink, stream) = ws.split();

        Ok(Self {
            writer: AudioWriter { sink },
            reader: EventReader { stream },
        })
    }
}

impl AudioWriter {
    /// Sends a chunk of raw PCM audio (`pcm_s16le`, mono).
    pub async fn send(&mut self, chunk: &[u8]) -> Result<(), String> {
        self.sink
            .send(Message::Binary(chunk.to_vec()))
            .await
            .map_err(|e| format!("Failed to send audio: {e}"))
    }

    /// Signals the end of the audio stream.
    pub async fn finish(&mut self) -> Result<(), String> {
        self.sink
            .close()
            .await
            .map_err(|e| format!("Failed to close: {e}"))
    }
}

impl EventReader {
    /// Waits for the next transcription event, or `None` if the stream ended.
    pub async fn next(&mut self) -> Option<Result<TranscriptionEvent, String>> {
        loop {
            let msg = match self.stream.next().await? {
                Ok(m) => m,
                Err(e) => return Some(Err(format!("WebSocket error: {e}"))),
            };

            let text = match msg {
                Message::Text(t) => t,
                Message::Close(_) => return None,
                _ => continue,
            };

            match serde_json::from_str::<TranscriptionEvent>(&text) {
                Ok(e) => return Some(Ok(e)),
                Err(_) => continue,
            }
        }
    }
}
