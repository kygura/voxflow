/// Downmix interleaved audio (average of channels) and resample to 16 kHz.
///
/// ponytail: linear interpolation, no anti-aliasing low-pass. Speech energy sits well
/// below 8 kHz and Whisper is robust to the resulting aliasing (see RESEARCH.md §6);
/// swap in rubato only if WER measurably suffers.
pub fn to_16k_mono(interleaved: &[f32], channels: u16, rate: u32) -> Vec<f32> {
    to_mono(interleaved, channels, rate, 16_000)
}

/// [`to_16k_mono`] with any output rate (sound cue playback at the device rate).
pub fn to_mono(interleaved: &[f32], channels: u16, rate: u32, out_rate: u32) -> Vec<f32> {
    let out_rate = out_rate as u64;
    if channels == 0 || rate == 0 || out_rate == 0 {
        return Vec::new();
    }
    let ch = channels as usize;
    let mono: Vec<f32> = interleaved
        .chunks_exact(ch)
        .map(|frame| frame.iter().sum::<f32>() / ch as f32)
        .collect();
    if rate as u64 == out_rate || mono.is_empty() {
        return mono;
    }
    let out_len = (mono.len() as u64 * out_rate / rate as u64) as usize;
    let step = rate as f64 / out_rate as f64;
    let last = mono.len() - 1;
    (0..out_len)
        .map(|i| {
            let pos = i as f64 * step;
            let idx = (pos as usize).min(last);
            let frac = (pos - idx as f64) as f32;
            let next = mono[(idx + 1).min(last)];
            mono[idx] + (next - mono[idx]) * frac
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stereo_48k_to_16k_keeps_length_and_dc() {
        // 1 s of stereo: left 0.2, right 0.6 → mono DC 0.4.
        let input: Vec<f32> = (0..48_000).flat_map(|_| [0.2, 0.6]).collect();
        let out = to_16k_mono(&input, 2, 48_000);
        assert_eq!(out.len(), 16_000);
        assert!(out.iter().all(|s| (s - 0.4).abs() < 1e-6));
    }

    #[test]
    fn upsample_44k1_length() {
        let out = to_16k_mono(&vec![0.1; 44_100], 1, 44_100);
        assert_eq!(out.len(), 16_000);
        let out = to_16k_mono(&vec![0.1; 8_000], 1, 8_000);
        assert_eq!(out.len(), 16_000);
    }

    #[test]
    fn mono_16k_passthrough() {
        let input: Vec<f32> = (0..100).map(|i| i as f32 / 100.0).collect();
        assert_eq!(to_16k_mono(&input, 1, 16_000), input);
        assert!(to_16k_mono(&input, 0, 16_000).is_empty());
    }
}
