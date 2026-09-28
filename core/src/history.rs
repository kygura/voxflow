use crate::settings::Backend;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_ENTRIES: usize = 200;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub text: String,
    /// Unix milliseconds.
    pub created_at: u64,
    pub backend: Backend,
    pub model: String,
    pub duration_ms: u64,
    /// Transcript before cleanup; absent when identical to `text` (and in pre-v2 entries).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
}

impl HistoryEntry {
    /// New entry stamped with the current time and a unique id (`<unix ms hex>-<counter hex>`).
    pub fn new(text: String, backend: Backend, model: String, duration_ms: u64) -> Self {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let id = format!(
            "{created_at:x}-{:x}",
            COUNTER.fetch_add(1, Ordering::Relaxed)
        );
        Self {
            id,
            text,
            created_at,
            backend,
            model,
            duration_ms,
            raw: None,
        }
    }

    /// Record the pre-cleanup transcript, only if it differs from `text`.
    pub fn with_raw(mut self, raw: &str) -> Self {
        let raw = raw.trim();
        self.raw = (raw != self.text.trim()).then(|| raw.to_owned());
        self
    }
}

/// history.json: newest first, capped at [`MAX_ENTRIES`]. Mutations are in memory; call `save()`.
pub struct History {
    path: PathBuf,
    entries: Vec<HistoryEntry>,
}

impl History {
    /// Missing → empty. Corrupt → renamed to `history.json.bak`, empty.
    pub fn load(path: &Path) -> History {
        History {
            path: path.to_owned(),
            entries: crate::load_json_or_backup(path),
        }
    }

    pub fn entries(&self) -> &[HistoryEntry] {
        &self.entries
    }

    pub fn push(&mut self, entry: HistoryEntry) {
        self.entries.insert(0, entry);
        self.entries.truncate(MAX_ENTRIES);
    }

    /// Returns whether an entry was removed.
    pub fn delete(&mut self, id: &str) -> bool {
        let before = self.entries.len();
        self.entries.retain(|e| e.id != id);
        self.entries.len() != before
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn save(&self) -> Result<()> {
        crate::atomic_write(&self.path, &serde_json::to_vec(&self.entries)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(text: &str) -> HistoryEntry {
        HistoryEntry::new(text.into(), Backend::Local, "base".into(), 1234)
    }

    #[test]
    fn caps_at_200_newest_first() {
        let dir = crate::test_dir("history-cap");
        let mut h = History::load(&dir.join("history.json"));
        for i in 0..205 {
            h.push(entry(&i.to_string()));
        }
        assert_eq!(h.entries().len(), 200);
        assert_eq!(h.entries()[0].text, "204");
        assert_eq!(h.entries()[199].text, "5");
        let ids: std::collections::HashSet<_> = h.entries().iter().map(|e| &e.id).collect();
        assert_eq!(ids.len(), 200, "ids must be unique");
    }

    #[test]
    fn delete_clear_and_persist() {
        let dir = crate::test_dir("history-persist");
        let path = dir.join("history.json");
        let mut h = History::load(&path);
        h.push(entry("a"));
        h.push(entry("b"));
        h.push(entry("c"));
        let b_id = h.entries()[1].id.clone();
        assert!(h.delete(&b_id));
        assert!(!h.delete("nope"));
        h.save().unwrap();

        let h2 = History::load(&path);
        let texts: Vec<_> = h2.entries().iter().map(|e| e.text.as_str()).collect();
        assert_eq!(texts, ["c", "a"]);
        assert_eq!(h2.entries(), h.entries());
        let json: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(json[0]["durationMs"], 1234);
        assert_eq!(json[0]["backend"], "local");
        assert!(json[0]["createdAt"].as_u64().unwrap() > 0);

        let mut h3 = h2;
        h3.clear();
        h3.save().unwrap();
        assert!(History::load(&path).entries().is_empty());
    }

    #[test]
    fn raw_only_when_different_and_old_json_loads() {
        let same = entry("Hello.").with_raw(" Hello. ");
        assert_eq!(same.raw, None);
        let json = serde_json::to_value(&same).unwrap();
        assert!(json.get("raw").is_none(), "{json}");

        let cleaned = entry("I think so.").with_raw("um I I think so");
        assert_eq!(cleaned.raw.as_deref(), Some("um I I think so"));
        assert_eq!(
            serde_json::to_value(&cleaned).unwrap()["raw"],
            "um I I think so"
        );

        let dir = crate::test_dir("history-v1");
        let path = dir.join("history.json");
        std::fs::write(
            &path,
            r#"[{"id":"a-0","text":"old","createdAt":1,"backend":"remote","model":"whisper-1","durationMs":5}]"#,
        )
        .unwrap();
        let h = History::load(&path);
        assert_eq!(h.entries().len(), 1);
        assert_eq!(h.entries()[0].raw, None);
        assert!(path.exists(), "valid old file must not be moved to .bak");
    }
}
