//! VoxFlow core library: audio capture, transcription, settings, clipboard.
//! No Tauri dependency, unit-testable standalone. All APIs are blocking;
//! the shell runs them on its own threads.

pub mod audio;
pub mod cleanup;
pub mod decode;
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

#[cfg(test)]
/// Test-only one-shot HTTP server: returns the base URL and a handle yielding the raw request.
pub(crate) fn mock_http(status: &str, body: &str) -> (String, std::thread::JoinHandle<String>) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}/v1/", listener.local_addr().unwrap());
    let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
    let handle = std::thread::spawn(move || {
        use std::io::{BufRead, Read, Write};
        let (stream, _) = listener.accept().unwrap();
        let mut reader = std::io::BufReader::new(stream);
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
