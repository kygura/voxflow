use anyhow::{bail, ensure, Context, Result};
use serde::Serialize;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: &'static str,
    /// Approximate download size (decimal MB, as listed on Hugging Face).
    pub size_mb: u32,
    pub english_only: bool,
    pub downloaded: bool,
}

const fn m(name: &'static str, size_mb: u32, english_only: bool) -> ModelInfo {
    ModelInfo {
        name,
        size_mb,
        english_only,
        downloaded: false,
    }
}

/// whisper.cpp ggml models on huggingface.co/ggerganov/whisper.cpp.
pub const CATALOG: &[ModelInfo] = &[
    m("tiny", 78, false),
    m("tiny.en", 78, true),
    m("base", 148, false),
    m("base.en", 148, true),
    m("small", 488, false),
    m("small.en", 488, true),
    m("medium", 1530, false),
    m("large-v3-turbo", 1620, false),
    m("large-v3-turbo-q5_0", 574, false),
];

/// Catalog with `downloaded` reflecting files present in `dir`.
pub fn list(dir: &Path) -> Vec<ModelInfo> {
    CATALOG
        .iter()
        .map(|info| ModelInfo {
            downloaded: dir.join(file_name(info.name)).is_file(),
            ..info.clone()
        })
        .collect()
}

fn file_name(name: &str) -> String {
    format!("ggml-{name}.bin")
}

/// Path of a catalog model. Names outside the catalog are rejected, which also
/// blocks path traversal via names coming from the frontend.
pub fn model_path(dir: &Path, name: &str) -> Result<PathBuf> {
    ensure!(
        CATALOG.iter().any(|m| m.name == name),
        "unknown model: {name}"
    );
    Ok(dir.join(file_name(name)))
}

/// Download a model to `dir` via `<file>.part` + rename. `progress(downloaded, total)` is
/// throttled (every 256 KiB or 100 ms, plus a final call); `total` is 0 when unknown.
/// Setting `cancel` aborts with error "cancelled". The `.part` file is removed on any failure.
pub fn download(
    dir: &Path,
    name: &str,
    cancel: &AtomicBool,
    mut progress: impl FnMut(u64, u64),
) -> Result<PathBuf> {
    let path = model_path(dir, name)?;
    std::fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
    let part = path.with_extension("bin.part");
    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
        file_name(name)
    );
    let result = (|| -> Result<()> {
        // ponytail: no whole-request timeout (big files); a stalled-but-open connection blocks
        // until TCP gives up, and cancel is only checked between reads.
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .tcp_keepalive(Duration::from_secs(30))
            .timeout(None)
            .build()?;
        let mut resp = client.get(&url).send()?.error_for_status()?;
        let total = resp.content_length();
        let mut file =
            std::fs::File::create(&part).with_context(|| format!("create {}", part.display()))?;
        let mut buf = vec![0u8; 64 * 1024];
        let (mut done, mut reported, mut last) = (0u64, 0u64, Instant::now());
        loop {
            if cancel.load(Ordering::Relaxed) {
                bail!("cancelled");
            }
            let n = resp.read(&mut buf).context("download interrupted")?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n])?;
            done += n as u64;
            if done - reported >= 256 * 1024 || last.elapsed() >= Duration::from_millis(100) {
                progress(done, total.unwrap_or(0));
                (reported, last) = (done, Instant::now());
            }
        }
        progress(done, total.unwrap_or(done));
        if let Some(total) = total {
            ensure!(
                done == total,
                "download incomplete: got {done} of {total} bytes"
            );
        }
        file.sync_all()?;
        drop(file);
        std::fs::rename(&part, &path)?;
        Ok(())
    })();
    if let Err(e) = result {
        let _ = std::fs::remove_file(&part);
        return Err(e);
    }
    Ok(path)
}

/// Delete a downloaded model. Not downloaded is not an error.
pub fn delete(dir: &Path, name: &str) -> Result<()> {
    match std::fs::remove_file(model_path(dir, name)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_path_rejects_unknown_and_traversal() {
        let dir = Path::new("/models");
        assert!(model_path(dir, "../x").is_err());
        assert!(model_path(dir, "huge").is_err());
        assert!(model_path(dir, "").is_err());
        assert_eq!(
            model_path(dir, "base.en").unwrap(),
            dir.join("ggml-base.en.bin")
        );
    }

    #[test]
    fn list_reports_downloaded_and_delete_removes() {
        let dir = crate::test_dir("models");
        assert!(list(&dir).iter().all(|m| !m.downloaded));
        std::fs::write(dir.join("ggml-tiny.en.bin"), b"x").unwrap();
        std::fs::write(dir.join("ggml-base.bin.part"), b"x").unwrap();
        let l = list(&dir);
        assert_eq!(l.len(), CATALOG.len());
        let got: Vec<_> = l.iter().filter(|m| m.downloaded).map(|m| m.name).collect();
        assert_eq!(got, ["tiny.en"]);
        let json = serde_json::to_value(&l[1]).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"name":"tiny.en","sizeMb":78,"englishOnly":true,"downloaded":true})
        );
        delete(&dir, "tiny.en").unwrap();
        delete(&dir, "tiny.en").unwrap();
        assert!(list(&dir).iter().all(|m| !m.downloaded));
    }

    #[test]
    fn download_rejects_unknown_before_network() {
        let err = download(
            Path::new("/nonexistent"),
            "../etc",
            &AtomicBool::new(false),
            |_, _| {},
        );
        assert!(err.unwrap_err().to_string().contains("unknown model"));
    }
}
