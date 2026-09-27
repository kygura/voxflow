//! VoxFlow core library: audio capture, transcription, settings, clipboard.
//! No Tauri dependency, unit-testable standalone. All APIs are blocking;
//! the shell runs them on its own threads.

pub mod audio;
pub mod history;
pub mod models;
pub mod output;
pub mod resample;
pub mod settings;
pub mod transcribe;
pub mod wav;

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use std::path::Path;

/// Write `bytes` to `path` atomically: temp file in the same dir, fsync, rename.
/// A crash mid-write leaves the old file intact instead of a truncated one.
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    let dir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
    let name = path
        .file_name()
        .context("path has no file name")?
        .to_string_lossy();
    let tmp = dir.join(format!(".{name}.tmp"));
    let mut f = std::fs::File::create(&tmp).with_context(|| format!("create {}", tmp.display()))?;
    f.write_all(bytes)?;
    f.sync_all()?;
    drop(f);
    // std::fs::rename replaces an existing target on Windows too (MoveFileExW REPLACE_EXISTING).
    std::fs::rename(&tmp, path).with_context(|| format!("rename to {}", path.display()))
}

/// Load JSON from `path`. Missing/unreadable → `T::default()`. Unparseable →
/// renamed to `<file>.bak` (so the next save can't destroy it) and `T::default()`.
pub(crate) fn load_json_or_backup<T: DeserializeOwned + Default>(path: &Path) -> T {
    let Ok(text) = std::fs::read_to_string(path) else {
        return T::default();
    };
    match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            let mut bak = path.as_os_str().to_owned();
            bak.push(".bak");
            eprintln!(
                "voxflow: {} is corrupt ({e}); moved to .bak",
                path.display()
            );
            let _ = std::fs::rename(path, bak);
            T::default()
        }
    }
}

/// Unique path under the OS temp dir for tests (no tempfile dep).
#[cfg(test)]
pub(crate) fn test_dir(tag: &str) -> std::path::PathBuf {
    use std::sync::atomic::{AtomicU32, Ordering};
    static N: AtomicU32 = AtomicU32::new(0);
    let d = std::env::temp_dir().join(format!(
        "voxflow-test-{}-{tag}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}
