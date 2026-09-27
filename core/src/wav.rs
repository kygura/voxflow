/// Encode 16 kHz mono f32 samples as a 16-bit PCM WAV (44-byte RIFF header).
pub fn encode_wav_16k_mono(samples: &[f32]) -> Vec<u8> {
    const RATE: u32 = 16_000;
    let data_len = (samples.len() * 2) as u32;
    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&RATE.to_le_bytes());
    out.extend_from_slice(&(RATE * 2).to_le_bytes()); // byte rate
    out.extend_from_slice(&2u16.to_le_bytes()); // block align
    out.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        out.extend_from_slice(&((s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16).to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_and_samples() {
        let w = encode_wav_16k_mono(&[0.0, 1.0, -1.0, 2.0]);
        let u32_at = |i: usize| u32::from_le_bytes(w[i..i + 4].try_into().unwrap());
        let u16_at = |i: usize| u16::from_le_bytes(w[i..i + 2].try_into().unwrap());
        assert_eq!(w.len(), 44 + 8);
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(u32_at(4), 36 + 8);
        assert_eq!(&w[8..16], b"WAVEfmt ");
        assert_eq!((u32_at(16), u16_at(20), u16_at(22)), (16, 1, 1));
        assert_eq!(
            (u32_at(24), u32_at(28), u16_at(32), u16_at(34)),
            (16_000, 32_000, 2, 16)
        );
        assert_eq!(&w[36..40], b"data");
        assert_eq!(u32_at(40), 8);
        let s = |i: usize| i16::from_le_bytes(w[44 + i * 2..46 + i * 2].try_into().unwrap());
        assert_eq!((s(0), s(1), s(2), s(3)), (0, i16::MAX, -i16::MAX, i16::MAX));
    }
}
