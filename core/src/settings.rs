use anyhow::{bail, ensure, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyMode {
    #[default]
    Hybrid,
    PushToTalk,
    Toggle,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Backend {
    #[default]
    Local,
    Remote,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Dark,
    Light,
}

/// OpenAI-compatible server. The API key is NOT here: it lives in the OS keyring only.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct RemoteConfig {
    pub base_url: String,
    pub model: String,
}

impl Default for RemoteConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.openai.com/v1".into(),
            model: "whisper-1".into(),
        }
    }
}

/// Post-transcription cleanup mode (SPEC v2).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Cleanup {
    Off,
    #[default]
    Basic,
    Ai,
}

/// OpenAI-compatible chat server for AI cleanup. Its key lives in its own keyring entry.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AiConfig {
    pub base_url: String,
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:11434/v1".into(),
            model: "llama3.2".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub hotkey: String,
    pub hotkey_mode: HotkeyMode,
    pub backend: Backend,
    pub local_model: String,
    pub remote: RemoteConfig,
    pub language: String,
    pub input_device: Option<String>,
    pub auto_paste: bool,
    pub restore_clipboard: bool,
    pub save_history: bool,
    pub theme: Theme,
    pub cleanup: Cleanup,
    pub ai: AiConfig,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Shift+Space".into(),
            hotkey_mode: HotkeyMode::Hybrid,
            backend: Backend::Local,
            local_model: "base".into(),
            remote: RemoteConfig::default(),
            language: "auto".into(),
            input_device: None,
            auto_paste: true,
            restore_clipboard: true,
            save_history: true,
            theme: Theme::System,
            cleanup: Cleanup::Basic,
            ai: AiConfig::default(),
        }
    }
}

/// http(s) URL with a host and no userinfo. `what` names the field in the error.
pub(crate) fn check_base_url(base_url: &str, what: &str) -> Result<()> {
    let Ok(url) = reqwest::Url::parse(base_url.trim()) else {
        bail!("{what} is not a valid URL");
    };
    ensure!(
        matches!(url.scheme(), "http" | "https") && url.host().is_some(),
        "{what} must be http:// or https://"
    );
    ensure!(
        url.username().is_empty() && url.password().is_none(),
        "{what} must not contain a username or password"
    );
    Ok(())
}

/// "auto" or an ISO-639-1 code (2 lowercase ASCII letters).
pub(crate) fn is_valid_language(lang: &str) -> bool {
    lang == "auto" || (lang.len() == 2 && lang.bytes().all(|b| b.is_ascii_lowercase()))
}

impl Settings {
    /// Missing file → defaults. Corrupt file → renamed to `settings.json.bak`, defaults.
    pub fn load(path: &Path) -> Settings {
        crate::load_json_or_backup(path)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        crate::atomic_write(path, &serde_json::to_vec_pretty(self)?)
    }

    /// Validate values coming from the frontend before they're saved/used.
    pub fn validate(&self) -> Result<()> {
        ensure!(!self.hotkey.trim().is_empty(), "hotkey must not be empty");
        check_base_url(&self.remote.base_url, "server URL")?;
        ensure!(
            !self.remote.model.trim().is_empty(),
            "server model must not be empty"
        );
        check_base_url(&self.ai.base_url, "AI server URL")?;
        ensure!(
            !self.ai.model.trim().is_empty(),
            "AI model must not be empty"
        );
        ensure!(
            is_valid_language(&self.language),
            "language must be \"auto\" or a 2-letter code"
        );
        ensure!(
            crate::models::CATALOG
                .iter()
                .any(|m| m.name == self.local_model),
            "unknown local model: {}",
            self.local_model
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_gives_spec_defaults() {
        let dir = crate::test_dir("settings-missing");
        let s = Settings::load(&dir.join("settings.json"));
        assert_eq!(s, Settings::default());
        assert_eq!(s.hotkey, "CommandOrControl+Shift+Space");
        assert_eq!(s.remote.base_url, "https://api.openai.com/v1");
        assert_eq!(s.remote.model, "whisper-1");
        assert!(s.validate().is_ok());
        let json = serde_json::to_value(&s).unwrap();
        assert_eq!(json["hotkeyMode"], "hybrid");
        assert_eq!(json["backend"], "local");
        assert_eq!(json["remote"]["baseUrl"], "https://api.openai.com/v1");
        assert_eq!(json["inputDevice"], serde_json::Value::Null);
        assert_eq!(json["cleanup"], "basic");
        assert_eq!(json["ai"]["baseUrl"], "http://localhost:11434/v1");
        assert_eq!(json["ai"]["model"], "llama3.2");
    }

    #[test]
    fn round_trip() {
        let dir = crate::test_dir("settings-rt");
        let path = dir.join("settings.json");
        let s = Settings {
            hotkey_mode: HotkeyMode::PushToTalk,
            backend: Backend::Remote,
            input_device: Some("USB Mic".into()),
            theme: Theme::Dark,
            language: "es".into(),
            cleanup: Cleanup::Ai,
            ai: AiConfig {
                base_url: "https://api.groq.com/openai/v1".into(),
                model: "llama-3.1-8b-instant".into(),
            },
            ..Default::default()
        };
        s.save(&path).unwrap();
        assert_eq!(Settings::load(&path), s);
        assert!(!dir.join(".settings.json.tmp").exists());
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\"push_to_talk\""));
        assert!(raw.contains("\"cleanup\": \"ai\""));
    }

    #[test]
    fn corrupt_file_is_backed_up() {
        let dir = crate::test_dir("settings-corrupt");
        let path = dir.join("settings.json");
        std::fs::write(&path, "{ not json").unwrap();
        assert_eq!(Settings::load(&path), Settings::default());
        assert!(!path.exists());
        assert_eq!(
            std::fs::read_to_string(dir.join("settings.json.bak")).unwrap(),
            "{ not json"
        );
    }

    #[test]
    fn unknown_and_missing_fields_fall_back() {
        let dir = crate::test_dir("settings-partial");
        let path = dir.join("settings.json");
        std::fs::write(
            &path,
            r#"{"autoPaste":false,"futureThing":42,"remote":{"model":"x"}}"#,
        )
        .unwrap();
        let s = Settings::load(&path);
        assert!(!s.auto_paste);
        assert_eq!(s.remote.model, "x");
        assert_eq!(s.remote.base_url, "https://api.openai.com/v1");
        assert_eq!(s.hotkey, Settings::default().hotkey);
        assert_eq!(s.cleanup, Cleanup::Basic); // pre-v2 file
        assert_eq!(s.ai, AiConfig::default());
    }

    #[test]
    fn validate_rejects_bad_values() {
        let bad = |f: fn(&mut Settings)| {
            let mut s = Settings::default();
            f(&mut s);
            s.validate().is_err()
        };
        assert!(bad(|s| s.remote.base_url = "not a url".into()));
        assert!(bad(|s| s.remote.base_url = "ftp://example.com".into()));
        assert!(bad(|s| s.remote.base_url = "file:///etc/passwd".into()));
        assert!(bad(
            |s| s.remote.base_url = "https://user:pw@example.com/v1".into()
        ));
        assert!(bad(
            |s| s.remote.base_url = "http://user@example.com/v1".into()
        ));
        assert!(bad(|s| s.remote.model = "  ".into()));
        assert!(bad(|s| s.language = "english".into()));
        assert!(bad(|s| s.local_model = "../evil".into()));
        assert!(bad(|s| s.ai.base_url = "ftp://example.com".into()));
        assert!(bad(|s| s.ai.base_url = "https://k:sk@example.com/v1".into()));
        assert!(bad(|s| s.ai.model = "".into()));
        let mut ok = Settings::default();
        ok.remote.base_url = "http://localhost:8000/v1".into();
        ok.language = "de".into();
        assert!(ok.validate().is_ok());
        ok.remote.base_url = "http://192.168.1.20:8000/v1".into(); // LAN speaches server
        assert!(ok.validate().is_ok());
    }
}
