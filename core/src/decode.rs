//! Audio file decoding for "Transcribe file" (pure-Rust symphonia).

use anyhow::{bail, Context, Result};
use std::path::Path;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

/// Longest file accepted, in seconds (same cap as a recording).
pub const MAX_SECONDS: u64 = 600;
/// Highest sample rate accepted; with the duration cap it bounds decoded memory.
const MAX_RATE: u32 = 384_000;

/// Decode wav/mp3/m4a(aac)/ogg(vorbis)/flac to 16 kHz mono f32.
pub fn decode_file(path: &Path) -> Result<Vec<f32>> {
    let file = std::fs::File::open(path).with_context(|| format!("open {}", path.display()))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let mut format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .context("unsupported or corrupt audio file")?;
    let track = format
        .default_track(TrackType::Audio)
        .context("file has no audio track")?;
    let track_id = track.id;
    let params = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .context("file has no audio track")?;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(params, &AudioDecoderOptions::default())
        .context("unsupported audio codec")?;

    let (mut mono, mut buf, mut rate) = (Vec::<f32>::new(), Vec::<f32>::new(), 0u32);
    loop {
        let packet = match format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) => break,
            Err(Error::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e).context("failed to read audio file"),
        };
        if packet.track_id != track_id {
            continue;
        }
        let audio = match decoder.decode(&packet) {
            Ok(a) => a,
            Err(Error::DecodeError(_)) => continue, // skip a corrupt frame, keep the rest
            Err(e) => return Err(e).context("failed to decode audio"),
        };
        let (r, channels) = (audio.spec().rate(), audio.spec().channels().count());
        if rate == 0 {
            if !(8_000..=MAX_RATE).contains(&r) {
                bail!("unsupported sample rate");
            }
            rate = r;
        } else if r != rate {
            bail!("sample rate changes mid-file");
        }
        buf.resize(audio.samples_interleaved(), 0.0);
        audio.copy_to_slice_interleaved(&mut buf);
        // Downmix per packet (rate 16k = no resampling) to halve memory; resample once at the end.
        mono.extend(crate::resample::to_16k_mono(&buf, channels as u16, 16_000));
        if mono.len() as u64 > rate as u64 * MAX_SECONDS {
            bail!("file longer than 10 minutes");
        }
    }
    if mono.is_empty() {
        bail!("file contains no audio");
    }
    Ok(crate::resample::to_16k_mono(&mono, 1, rate))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// WAV from the 16k-mono encoder with the header patched to other rates/channels.
    fn wav(samples: &[f32], rate: u32, channels: u16) -> Vec<u8> {
        let mut w = crate::wav::encode_wav_16k_mono(samples);
        w[22..24].copy_from_slice(&channels.to_le_bytes());
        w[24..28].copy_from_slice(&rate.to_le_bytes());
        w[28..32].copy_from_slice(&rate.wrapping_mul(2 * channels as u32).to_le_bytes());
        w[32..34].copy_from_slice(&(2 * channels).to_le_bytes());
        w
    }

    #[test]
    fn stereo_48k_wav_becomes_16k_mono() {
        // 1 s stereo at 48 kHz: left 0.25, right 0.75 → mono 0.5.
        let samples: Vec<f32> = (0..48_000).flat_map(|_| [0.25, 0.75]).collect();
        let dir = crate::test_dir("decode-wav");
        let path = dir.join("a.wav");
        std::fs::write(&path, wav(&samples, 48_000, 2)).unwrap();
        let out = decode_file(&path).unwrap();
        assert_eq!(out.len(), 16_000);
        assert!(
            out.iter().all(|s| (s - 0.5).abs() < 1e-3),
            "{:?}",
            &out[..4]
        );
    }

    #[test]
    fn rejects_long_garbage_and_missing_files() {
        let dir = crate::test_dir("decode-bad");
        // 601 s at 8 kHz (the lowest accepted rate): over the cap.
        let long = dir.join("long.wav");
        std::fs::write(&long, wav(&vec![0.1; 601 * 8_000], 8_000, 1)).unwrap();
        assert_eq!(
            decode_file(&long).unwrap_err().to_string(),
            "file longer than 10 minutes"
        );
        let ok = dir.join("ok.wav");
        std::fs::write(&ok, wav(&vec![0.1; 599 * 8_000], 8_000, 1)).unwrap();
        assert_eq!(decode_file(&ok).unwrap().len(), 599 * 16_000);

        // Crafted headers: rates outside 8 kHz..=384 kHz are refused before buffering.
        for rate in [1_000, 7_999, 384_001, 4_000_000_000] {
            let bad = dir.join(format!("rate{rate}.wav"));
            std::fs::write(&bad, wav(&[0.1; 1_000], rate, 1)).unwrap();
            let err = decode_file(&bad).unwrap_err().to_string();
            assert_eq!(err, "unsupported sample rate", "{rate}");
        }

        let junk = dir.join("junk.mp3");
        std::fs::write(&junk, b"definitely not audio").unwrap();
        assert!(decode_file(&junk).is_err());
        assert!(decode_file(&dir.join("missing.wav")).is_err());
    }
}
