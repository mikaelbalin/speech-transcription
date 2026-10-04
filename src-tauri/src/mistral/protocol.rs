use serde::Deserialize;

/// A transcription event received over the Mistral realtime WebSocket.
///
/// Wire format uses dotted `type` discriminants, e.g. `"transcription.text.delta"`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum TranscriptionEvent {
    #[serde(rename = "session.created")]
    SessionCreated,
    #[serde(rename = "transcription.text.delta")]
    TextDelta { text: String },
    #[serde(rename = "transcription.done")]
    Done,
    #[serde(rename = "error")]
    Error { error: Option<MistralError> },
}

#[derive(Debug, Clone, Deserialize)]
pub struct MistralError {
    pub message: Option<String>,
}

impl std::fmt::Display for MistralError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message.as_deref().unwrap_or("unknown error"))
    }
}

#[cfg(test)]
mod tests {
    use super::TranscriptionEvent;

    #[test]
    fn parses_session_created() {
        let ev: TranscriptionEvent = serde_json::from_str(r#"{"type":"session.created"}"#).unwrap();
        assert!(matches!(ev, TranscriptionEvent::SessionCreated));
    }

    #[test]
    fn parses_text_delta() {
        let ev: TranscriptionEvent =
            serde_json::from_str(r#"{"type":"transcription.text.delta","text":"hello "}"#).unwrap();
        match ev {
            TranscriptionEvent::TextDelta { text } => assert_eq!(text, "hello "),
            other => panic!("expected TextDelta, got {other:?}"),
        }
    }

    #[test]
    fn parses_done() {
        let ev: TranscriptionEvent =
            serde_json::from_str(r#"{"type":"transcription.done"}"#).unwrap();
        assert!(matches!(ev, TranscriptionEvent::Done));
    }
}
