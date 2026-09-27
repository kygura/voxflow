use anyhow::{bail, ensure, Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: &'static str,
    /// Download size in decimal MB (rounded).
    pub size_mb: u32,
    pub english_only: bool,
    pub downloaded: bool,
    #[serde(skip)]
    size: u64,
    #[serde(skip)]
    sha256: &'static str,
}

const fn m(name: &'static str, size: u64, english_only: bool, sha256: &'static str) -> ModelInfo {
    ModelInfo {
        name,
        size_mb: ((size + 500_000) / 1_000_000) as u32,
        english_only,
        downloaded: false,
        size,
        sha256,
    }
}

/// Pinned commit of huggingface.co/ggerganov/whisper.cpp; sizes and sha256 are its LFS oids.
const REVISION: &str = "5359861c739e955e79d9a303bcbc70fb988958b1";

/// whisper.cpp ggml models on huggingface.co/ggerganov/whisper.cpp.
#[rustfmt::skip]
pub const CATALOG: &[ModelInfo] = &[
    m("tiny", 77_691_713, false, "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21"),
    m("tiny.en", 77_704_715, true, "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f"),
    m("base", 147_951_465, false, "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"),
    m("base.en", 147_964_211, true, "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002"),
    m("small", 487_601_967, false, "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b"),
    m("small.en", 487_614_201, true, "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d"),
    m("medium", 1_533_763_059, false, "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208"),
    m("large-v3-turbo", 1_624_555_275, false, "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69"),
    m("large-v3-turbo-q5_0", 574_041_195, false, "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2"),
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
    info(name)?;
    Ok(dir.join(file_name(name)))
}

fn info(name: &str) -> Result<&'static ModelInfo> {
    CATALOG
        .iter()
        .find(|m| m.name == name)
        .with_context(|| format!("unknown model: {name}"))
}

/// Download a model to `dir` via `<file>.part` + rename. `progress(downloaded, total)` is
/// throttled (every 256 KiB or 100 ms, plus a final call); `total` is 0 when unknown.
/// Setting `cancel` aborts with error "cancelled". The file's size and sha256 are checked
/// against the catalog before the rename. The `.part` file is removed on any failure.
pub fn download(
    dir: &Path,
    name: &str,
    cancel: &AtomicBool,
    mut progress: impl FnMut(u64, u64),
) -> Result<PathBuf> {
    let path = model_path(dir, name)?;
    let info = info(name)?;
    std::fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
    let part = path.with_extension("bin.part");
    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/{REVISION}/{}",
        file_name(name)
    );
    let result = (|| -> Result<()> {
        // The blocking client's `timeout` bounds the wait for response headers and then each
        // body read separately (reqwest 0.13 blocking::Response::read), not the whole download;
        // a stall of 60 s fails it. Cancel is checked between reads.
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .tcp_keepalive(Duration::from_secs(30))
            .timeout(Duration::from_secs(60))
            .build()?;
        let mut resp = client.get(&url).send()?.error_for_status()?;
        let total = resp.content_length();
        let mut file =
            std::fs::File::create(&part).with_context(|| format!("create {}", part.display()))?;
        let mut buf = vec![0u8; 64 * 1024];
        let mut hasher = Sha256::new();
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
            hasher.update(&buf[..n]);
            done += n as u64;
            if done - reported >= 256 * 1024 || last.elapsed() >= Duration::from_millis(100) {
                progress(done, total.unwrap_or(0));
                (reported, last) = (done, Instant::now());
            }
        }
        progress(done, total.unwrap_or(done));
        ensure!(
            done == info.size,
            "download incomplete: got {done} of {} bytes",
            info.size
        );
        ensure!(hex(&hasher.finalize()) == info.sha256, "checksum mismatch");
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

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
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
    fn catalog_is_pinned_and_hashed() {
        assert_eq!(REVISION.len(), 40);
        for m in CATALOG {
            assert!(m.size > 0, "{}", m.name);
            assert_eq!(m.sha256.len(), 64, "{}", m.name);
            assert!(m.sha256.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
        }
        assert_eq!(
            hex(&Sha256::digest(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
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
