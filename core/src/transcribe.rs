//! Transcription backends. `language` is "auto" or an ISO-639-1 code.

use anyhow::Result;
use std::path::Path;

#[cfg(feature = "local-whisper")]
use {
    anyhow::{ensure, Context},
    std::path::PathBuf,
    whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters},
};

/// Local whisper.cpp engine. Caches the loaded model and reloads only when the path changes.
/// Built without the `local-whisper` feature it still exists but always returns an error,
/// so the shell compiles either way.
#[derive(Default)]
pub struct LocalEngine {
    #[cfg(feature = "local-whisper")]
    loaded: Option<(PathBuf, WhisperContext)>,
}

impl LocalEngine {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(feature = "local-whisper")]
    pub fn transcribe(
        &mut self,
        model_path: &Path,
        audio: &[f32],
        language: &str,
    ) -> Result<String> {
        ensure!(
            crate::settings::is_valid_language(language),
            "invalid language: {language}"
        );
        if self.loaded.as_ref().is_none_or(|(p, _)| p != model_path) {
            self.loaded = None; // free the old model before loading the new one
            ensure!(
                model_path.is_file(),
                "model not downloaded: {}",
                model_path.display()
            );
            let ctx =
                WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
                    .with_context(|| format!("failed to load model {}", model_path.display()))?;
            self.loaded = Some((model_path.to_owned(), ctx));
        }
        let (_, ctx) = self.loaded.as_ref().expect("loaded above");
        let mut state = ctx.create_state()?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let threads = std::thread::available_parallelism()
            .map_or(4, |n| n.get())
            .min(8);
        params.set_n_threads(threads as _);
        params.set_language(Some(language)); // "auto" = detect, then transcribe
        params.set_translate(false);
        params.set_no_timestamps(true);
        params.set_suppress_blank(true);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        state
            .full(params, audio)
            .context("whisper inference failed")?;
        let mut text = String::new();
        for i in 0..state.full_n_segments() {
            if let Some(seg) = state.get_segment(i) {
                text.push_str(&seg.to_str_lossy()?);
            }
        }
        Ok(text.trim().to_owned())
    }

    #[cfg(not(feature = "local-whisper"))]
    pub fn transcribe(
        &mut self,
        _model_path: &Path,
        _audio: &[f32],
        _language: &str,
    ) -> Result<String> {
        anyhow::bail!(
            "this build has no local transcription (built without the local-whisper feature)"
        )
    }
}

pub mod remote {
    use crate::settings::RemoteConfig;
    use anyhow::{bail, Context, Result};
    use reqwest::blocking::multipart::{Form, Part};
    use std::time::Duration;

    /// POST the audio to an OpenAI-compatible `/audio/transcriptions` endpoint.
    /// Errors never contain the API key.
    pub fn transcribe(
        cfg: &RemoteConfig,
        api_key: Option<&str>,
        audio: &[f32],
        language: &str,
    ) -> Result<String> {
        let url = format!(
            "{}/audio/transcriptions",
            cfg.base_url.trim().trim_end_matches('/')
        );
        let file = Part::bytes(crate::wav::encode_wav_16k_mono(audio))
            .file_name("audio.wav")
            .mime_str("audio/wav")?;
        let mut form = Form::new()
            .part("file", file)
            .text("model", cfg.model.trim().to_owned())
            .text("response_format", "json");
        if !language.is_empty() && language != "auto" {
            form = form.text("language", language.to_owned());
        }
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()?;
        let mut req = client.post(&url).multipart(form);
        let key = api_key.map(str::trim).filter(|k| !k.is_empty());
        if let Some(key) = key {
            req = req.bearer_auth(key);
        }
        // reqwest errors mention the URL, never headers, so the key can't leak here.
        let resp = req.send().context("could not reach transcription server")?;
        let status = resp.status();
        let body = resp.text().context("failed to read server response")?;
        let json: Option<serde_json::Value> = serde_json::from_str(&body).ok();
        if !status.is_success() {
            let msg = json
                .as_ref()
                .and_then(|j| j["error"]["message"].as_str().map(str::to_owned))
                .unwrap_or(body);
            let mut msg: String = msg.trim().chars().take(300).collect();
            if let Some(key) = key {
                msg = msg.replace(key, "***"); // in case the server echoes it back
            }
            bail!("server returned {status}: {msg}");
        }
        match json.as_ref().and_then(|j| j["text"].as_str()) {
            Some(text) => Ok(text.trim().to_owned()),
            None => bail!("server response has no \"text\" field"),
        }
    }

    /// Check server URL, model and key by transcribing 0.5 s of silence.
    pub fn test(cfg: &RemoteConfig, api_key: Option<&str>) -> Result<String> {
        transcribe(cfg, api_key, &[0.0; 8_000], "auto")?;
        Ok("Connected".into())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::io::{BufRead, BufReader, Read, Write};
        use std::net::TcpListener;
        use std::thread::JoinHandle;

        /// One-shot HTTP server: returns the base URL and a handle yielding the raw request.
        fn mock(status: &str, body: &str) -> (String, JoinHandle<String>) {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let base = format!("http://{}/v1/", listener.local_addr().unwrap());
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let handle = std::thread::spawn(move || {
                let (stream, _) = listener.accept().unwrap();
                let mut reader = BufReader::new(stream);
                let mut head = String::new();
                let mut len = 0usize;
                loop {
                    let mut line = String::new();
                    reader.read_line(&mut line).unwrap();
                    if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                        len = v.trim().parse().unwrap();
                    }
                    head.push_str(&line);
                    if line == "\r\n" {
                        break;
                    }
                }
                let mut body = vec![0; len];
                reader.read_exact(&mut body).unwrap();
                reader.get_mut().write_all(response.as_bytes()).unwrap();
                head + &String::from_utf8_lossy(&body)
            });
            (base, handle)
        }

        fn cfg(base_url: String) -> RemoteConfig {
            RemoteConfig {
                base_url,
                model: "whisper-large-v3-turbo".into(),
            }
        }

        #[test]
        fn sends_multipart_with_auth_and_parses_text() {
            let (base, h) = mock("200 OK", r#"{"text":"  hello world \n"}"#);
            let text = transcribe(&cfg(base), Some("sk-secret"), &[0.0; 1600], "en").unwrap();
            assert_eq!(text, "hello world");
            let req = h.join().unwrap();
            assert!(
                req.starts_with("POST /v1/audio/transcriptions HTTP/1.1\r\n"),
                "{req}"
            );
            let lower = req.to_ascii_lowercase();
            assert!(lower.contains("authorization: bearer sk-secret\r\n"));
            assert!(lower.contains("content-type: multipart/form-data"));
            assert!(req.contains("name=\"model\"\r\n\r\nwhisper-large-v3-turbo\r\n"));
            assert!(req.contains("name=\"language\"\r\n\r\nen\r\n"));
            assert!(req.contains("name=\"response_format\"\r\n\r\njson\r\n"));
            assert!(req.contains("filename=\"audio.wav\""));
            assert!(req.contains("RIFF"));
        }

        #[test]
        fn no_auth_header_without_key_and_no_language_when_auto() {
            let (base, h) = mock("200 OK", r#"{"text":"hi"}"#);
            assert_eq!(
                transcribe(&cfg(base), Some(""), &[0.0; 1600], "auto").unwrap(),
                "hi"
            );
            let req = h.join().unwrap();
            assert!(!req.to_ascii_lowercase().contains("authorization:"));
            assert!(!req.contains("name=\"language\""));

            let (base, h) = mock("200 OK", r#"{"text":"x"}"#);
            assert_eq!(test(&cfg(base), None).unwrap(), "Connected");
            assert!(!h
                .join()
                .unwrap()
                .to_ascii_lowercase()
                .contains("authorization:"));
        }

        #[test]
        fn error_status_maps_message_without_leaking_key() {
            let body = r#"{"error":{"message":"Incorrect API key provided: sk-secret-123"}}"#;
            let (base, h) = mock("401 Unauthorized", body);
            let err =
                transcribe(&cfg(base), Some("sk-secret-123"), &[0.0; 1600], "auto").unwrap_err();
            h.join().unwrap();
            let msg = format!("{err:#}");
            assert!(msg.contains("401"), "{msg}");
            assert!(msg.contains("Incorrect API key provided"), "{msg}");
            assert!(!msg.contains("sk-secret-123"), "{msg}");

            let long = "x".repeat(1000);
            let (base, h) = mock("500 Internal Server Error", &long);
            let err = test(&cfg(base), None).unwrap_err();
            h.join().unwrap();
            let msg = err.to_string();
            assert!(msg.contains("500") && msg.len() < 400, "{msg}");
        }
    }
}

#[cfg(all(test, feature = "local-whisper"))]
mod tests {
    use super::*;

    /// Needs a real model: VOXFLOW_TEST_MODEL=/path/ggml-tiny.bin cargo test -- --ignored
    #[test]
    #[ignore]
    fn local_whisper_loads_and_runs() {
        let Ok(path) = std::env::var("VOXFLOW_TEST_MODEL") else {
            return;
        };
        let mut engine = LocalEngine::new();
        let text = engine
            .transcribe(Path::new(&path), &[0.0; 16_000], "auto")
            .unwrap();
        assert!(text.len() < 200, "{text}");
        assert!(engine
            .transcribe(Path::new(&path), &[0.0; 16_000], "en")
            .is_ok());
        assert!(engine
            .transcribe(Path::new(&path), &[0.0; 16_000], "bad\0")
            .is_err());
    }
}
