use anyhow::{anyhow, Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// Recordings shorter than this (0.3 s at 16 kHz) are discarded.
pub const MIN_SAMPLES: usize = 4_800;
/// Audio beyond this is dropped; the shell auto-stops using [`Recorder::elapsed`].
pub const MAX_DURATION: Duration = Duration::from_secs(600);
/// Level meter block: one `on_level` value per 25 ms of real input (40 Hz).
pub const LEVEL_BLOCK_MS: u64 = 25;
/// Bundled 5.6 s English speech clip (mp3) for the overlay demo; source and license in
/// docs/ASSETS.md. It says [`DEMO_CLIP_TEXT`].
pub const DEMO_CLIP: &[u8] = include_bytes!("../assets/demo_speech.mp3");
pub const DEMO_CLIP_TEXT: &str =
    "The work wasn't finished at 11:00 p.m. Friday, so they decided to carry it over to the following Monday.";

/// Names of available input devices (for the settings picker).
pub fn list_input_devices() -> Result<Vec<String>> {
    let host = cpal::default_host();
    Ok(host
        .input_devices()?
        .filter_map(|d| d.description().ok().map(|x| x.name().to_owned()))
        .collect())
}

/// The start cue (90 ms tone plus output latency) can leak into the mic. With sounds on, this
/// much of the recording's head is ignored by the silence checks (the audio itself is kept).
pub const CUE_SKIP: Duration = Duration::from_millis(200);

/// True when no 30 ms window after the first `skip` of 16 kHz audio reaches speech level.
///
/// ponytail: fixed RMS threshold (0.005 ≈ -46 dBFS); a real VAD if quiet mics get dropped.
pub fn is_probably_silent(samples: &[f32], skip: Duration) -> bool {
    let skip = (16 * skip.as_millis() as usize).min(samples.len());
    !samples[skip..].chunks(480).any(|w| rms(w) > 0.005)
}

fn rms(s: &[f32]) -> f32 {
    if s.is_empty() {
        return 0.0;
    }
    (s.iter().map(|x| x * x).sum::<f32>() / s.len() as f32).sqrt()
}

/// Perceptual 0..1 level of one block of samples: RMS in dBFS mapped linearly from -55 dB (0)
/// to 0 dB (1), then a slight gamma (0.8) so normal speech (~-30 dBFS → 0.53) fills the range.
/// Loudness is perceived logarithmically; a linear map would leave the waveform flat.
pub fn level(block: &[f32]) -> f32 {
    let db = 20.0 * rms(block).max(1e-9).log10();
    ((db + 55.0) / 55.0).clamp(0.0, 1.0).powf(0.8)
}

/// [`level`] per [`LEVEL_BLOCK_MS`] block of 16 kHz mono audio.
pub fn envelope(samples: &[f32]) -> Vec<f32> {
    samples.chunks(16 * LEVEL_BLOCK_MS as usize).map(level).collect()
}

/// Hands-free auto-stop (SPEC v3): this long of continuous level below [`SILENCE_LEVEL`].
pub const SILENCE_STOP: Duration = Duration::from_secs(30);
pub const SILENCE_LEVEL: f32 = 0.08;

/// Feed it every [`level`] block; `push` returns true once, on the block that completes
/// [`SILENCE_STOP`] of continuous quiet. Any louder block restarts the count.
#[derive(Default)]
pub struct SilenceDetector {
    quiet: u64,
    skip: u64,
}

impl SilenceDetector {
    /// Ignores the blocks covering the first `skip` (see [`CUE_SKIP`]).
    pub fn skipping(skip: Duration) -> Self {
        Self { quiet: 0, skip: skip.as_millis() as u64 / LEVEL_BLOCK_MS }
    }

    pub fn push(&mut self, level: f32) -> bool {
        if self.skip > 0 {
            self.skip -= 1;
            return false;
        }
        self.quiet = if level < SILENCE_LEVEL { self.quiet + 1 } else { 0 };
        self.quiet == SILENCE_STOP.as_millis() as u64 / LEVEL_BLOCK_MS
    }
}

/// Short 16 kHz sound cue: a sine gliding `from_hz` → `to_hz` under a half-sine envelope
/// (no clicks), peak 0.2.
pub fn tone(from_hz: f32, to_hz: f32, ms: u32) -> Vec<f32> {
    let n = 16 * ms as usize;
    let mut phase = 0.0f32;
    (0..n)
        .map(|i| {
            let t = i as f32 / n as f32;
            phase += std::f32::consts::TAU * (from_hz + (to_hz - from_hz) * t) / 16_000.0;
            0.2 * (std::f32::consts::PI * t).sin() * phase.sin()
        })
        .collect()
}

/// Play 16 kHz mono audio on the default output device, on its own thread (a cpal `Stream`
/// is `!Send`). Dropping the returned sender stops it. No output device: skipped silently.
pub fn play(samples: Vec<f32>) -> mpsc::Sender<()> {
    let (tx, rx) = mpsc::channel::<()>();
    let len = Duration::from_millis(samples.len() as u64 / 16 + 300);
    let _ = std::thread::Builder::new()
        .name("voxflow-play".into())
        .spawn(move || match open_output(samples) {
            Ok(_stream) => drop(rx.recv_timeout(len)), // Err(Disconnected) = sender dropped = stop
            Err(e) => eprintln!("voxflow: audio playback skipped: {e:#}"),
        });
    tx
}

fn open_output(samples: Vec<f32>) -> Result<cpal::Stream> {
    let device = cpal::default_host()
        .default_output_device()
        .context("no output device")?;
    let config = device.default_output_config()?;
    let ch = config.channels() as usize;
    let mono = crate::resample::to_mono(&samples, 1, 16_000, config.sample_rate());
    let cfg = config.config();
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => output::<f32>(&device, cfg, mono, ch),
        cpal::SampleFormat::I16 => output::<i16>(&device, cfg, mono, ch),
        cpal::SampleFormat::I32 => output::<i32>(&device, cfg, mono, ch),
        cpal::SampleFormat::U16 => output::<u16>(&device, cfg, mono, ch),
        f => return Err(anyhow!("unsupported output sample format {f:?}")),
    }?;
    stream.play()?;
    Ok(stream)
}

fn output<T>(device: &cpal::Device, cfg: cpal::StreamConfig, mono: Vec<f32>, ch: usize) -> Result<cpal::Stream>
where
    T: SizedSample + FromSample<f32>,
{
    let mut it = mono.into_iter();
    Ok(device.build_output_stream(
        cfg,
        move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
            for frame in data.chunks_mut(ch.max(1)) {
                frame.fill(T::from_sample(it.next().unwrap_or(0.0)));
            }
        },
        |e| eprintln!("voxflow: audio output error: {e}"),
        None,
    )?)
}

/// Live microphone capture. The cpal `Stream` (which is `!Send` on some backends) lives on
/// its own thread; `Recorder` only holds channel/thread handles, so it is `Send`.
/// Dropping without `stop()` cancels: the thread sees the channel close and discards audio.
pub struct Recorder {
    stop_tx: mpsc::Sender<()>,
    thread: JoinHandle<Result<Vec<f32>>>,
    started: Instant,
}

impl Recorder {
    /// Start capturing from `device` (by name; `None` or not found → system default).
    /// `on_level` gets 0..1 at ~30 Hz from the audio thread.
    pub fn start(
        device: Option<&str>,
        on_level: impl FnMut(f32) + Send + 'static,
    ) -> Result<Recorder> {
        let device = device.map(str::to_owned);
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<()>>();
        let thread = std::thread::Builder::new()
            .name("voxflow-audio".into())
            .spawn(move || {
                let (stream, buf, channels, rate) =
                    match open_stream(device.as_deref(), Box::new(on_level)) {
                        Ok(v) => v,
                        Err(e) => {
                            let _ = ready_tx.send(Err(e));
                            return Ok(Vec::new());
                        }
                    };
                let _ = ready_tx.send(Ok(()));
                let stopped = stop_rx.recv().is_ok(); // Err = Recorder dropped = cancel
                drop(stream);
                if !stopped {
                    return Ok(Vec::new());
                }
                let raw = std::mem::take(&mut *buf.lock().unwrap_or_else(|e| e.into_inner()));
                Ok(crate::resample::to_16k_mono(&raw, channels, rate))
            })?;
        ready_rx.recv().context("audio thread died")??;
        Ok(Recorder {
            stop_tx,
            thread,
            started: Instant::now(),
        })
    }

    pub fn elapsed(&self) -> Duration {
        self.started.elapsed()
    }

    /// Stop and return the recording as 16 kHz mono f32.
    pub fn stop(self) -> Result<Vec<f32>> {
        let _ = self.stop_tx.send(());
        self.thread
            .join()
            .map_err(|_| anyhow!("audio thread panicked"))?
    }
}

type Opened = (cpal::Stream, Arc<Mutex<Vec<f32>>>, u16, u32);

fn open_stream(name: Option<&str>, on_level: Box<dyn FnMut(f32) + Send>) -> Result<Opened> {
    let host = cpal::default_host();
    let named = name.and_then(|n| {
        host.input_devices()
            .ok()?
            .find(|d| d.description().is_ok_and(|x| x.name() == n))
    });
    if let (Some(n), None) = (name, &named) {
        // ponytail: silent fallback to default so an unplugged USB mic doesn't break dictation.
        eprintln!("voxflow: input device {n:?} not found, using default");
    }
    let device = match named {
        Some(d) => d,
        None => host.default_input_device().context("no microphone found")?,
    };
    let config = device
        .default_input_config()
        .context("microphone has no usable input config")?;
    let (channels, rate) = (config.channels(), config.sample_rate());
    let cap = rate as usize * channels as usize * MAX_DURATION.as_secs() as usize;
    let buf = Arc::new(Mutex::new(Vec::new()));
    let sink = Sink {
        buf: buf.clone(),
        cap,
        on_level,
        block: Vec::new(),
        block_len: (rate as usize * channels as usize * LEVEL_BLOCK_MS as usize / 1000).max(1),
    };
    let cfg = config.config();
    let stream = match config.sample_format() {
        cpal::SampleFormat::I8 => build::<i8>(&device, cfg, sink),
        cpal::SampleFormat::I16 => build::<i16>(&device, cfg, sink),
        cpal::SampleFormat::I32 => build::<i32>(&device, cfg, sink),
        cpal::SampleFormat::I64 => build::<i64>(&device, cfg, sink),
        cpal::SampleFormat::U8 => build::<u8>(&device, cfg, sink),
        cpal::SampleFormat::U16 => build::<u16>(&device, cfg, sink),
        cpal::SampleFormat::U32 => build::<u32>(&device, cfg, sink),
        cpal::SampleFormat::U64 => build::<u64>(&device, cfg, sink),
        cpal::SampleFormat::F32 => build::<f32>(&device, cfg, sink),
        cpal::SampleFormat::F64 => build::<f64>(&device, cfg, sink),
        f => return Err(anyhow!("unsupported microphone sample format {f:?}")),
    }?;
    stream.play().context("failed to start microphone")?;
    Ok((stream, buf, channels, rate))
}

struct Sink {
    buf: Arc<Mutex<Vec<f32>>>,
    cap: usize,
    on_level: Box<dyn FnMut(f32) + Send>,
    /// Current level block (interleaved samples); emitted and cleared every `block_len`.
    block: Vec<f32>,
    block_len: usize,
}

fn build<T>(device: &cpal::Device, cfg: cpal::StreamConfig, mut sink: Sink) -> Result<cpal::Stream>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    let stream = device.build_input_stream(
        cfg,
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            {
                let mut buf = sink.buf.lock().unwrap_or_else(|e| e.into_inner());
                let room = sink.cap.saturating_sub(buf.len());
                buf.extend(data.iter().take(room).map(|&s| f32::from_sample(s)));
            }
            for &s in data {
                sink.block.push(f32::from_sample(s));
                if sink.block.len() >= sink.block_len {
                    (sink.on_level)(level(&sink.block));
                    sink.block.clear();
                }
            }
        },
        |e| eprintln!("voxflow: audio stream error: {e}"),
        None,
    )?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_detection() {
        let none = Duration::ZERO;
        assert!(is_probably_silent(&vec![0.0; 16_000], none));
        assert!(is_probably_silent(&vec![0.001; 16_000], none));
        assert!(is_probably_silent(&[], CUE_SKIP));
        let mut speech = vec![0.0; 16_000];
        for (i, s) in speech[8_000..8_960].iter_mut().enumerate() {
            *s = 0.2 * (i as f32 * 0.1).sin();
        }
        assert!(!is_probably_silent(&speech, none));
        assert!(!is_probably_silent(&speech, CUE_SKIP));
        // Start cue captured by the mic, then silence: silent once the head is skipped.
        let mut cue = vec![0.0; 16_000];
        cue[..16 * 90].copy_from_slice(&tone(880.0, 1320.0, 90));
        assert!(!is_probably_silent(&cue, none));
        assert!(is_probably_silent(&cue, CUE_SKIP));
    }

    #[test]
    fn silence_detector_skips_cue_blocks() {
        let blocks = (SILENCE_STOP.as_millis() as u64 / LEVEL_BLOCK_MS) as usize;
        let skip = (CUE_SKIP.as_millis() as u64 / LEVEL_BLOCK_MS) as usize; // 8
        let mut d = SilenceDetector::skipping(CUE_SKIP);
        assert!((0..skip).all(|_| !d.push(1.0))); // loud cue neither counts nor resets
        assert!((0..blocks - 1).all(|_| !d.push(0.0)));
        assert!(d.push(0.0));
    }

    #[test]
    fn block_level_on_sine_and_silence() {
        let sine = |amp: f32| -> Vec<f32> {
            (0..400).map(|i| amp * (i as f32 * std::f32::consts::TAU * 440.0 / 16_000.0).sin()).collect()
        };
        assert_eq!(level(&[0.0; 400]), 0.0);
        assert_eq!(level(&[]), 0.0);
        assert_eq!(level(&[1.0; 400]), 1.0); // 0 dBFS
        assert_eq!(level(&[0.001_778; 400]), 0.0); // -55 dBFS floor
        // Full-scale sine: RMS -3 dBFS → (52/55)^0.8.
        assert!((level(&sine(1.0)) - (52.0f32 / 55.0).powf(0.8)).abs() < 0.01);
        // -30 dBFS RMS (typical speech) lands mid-range.
        let l = level(&sine(0.031_62 * 2f32.sqrt()));
        assert!((l - (25.0f32 / 55.0).powf(0.8)).abs() < 0.01, "{l}");
        assert_eq!(envelope(&vec![0.0; 16_000]).len(), 40); // 1 s = 40 blocks
    }

    #[test]
    fn demo_clip_envelope_is_speech_like() {
        let env = envelope(&crate::decode::decode_bytes(DEMO_CLIP, "mp3").unwrap());
        let secs = env.len() as f32 * LEVEL_BLOCK_MS as f32 / 1000.0;
        assert!((4.0..=8.0).contains(&secs), "{secs} s");
        let first = env.iter().position(|l| *l > 0.5).unwrap();
        let last = env.iter().rposition(|l| *l > 0.5).unwrap();
        let peaks = env.iter().filter(|l| **l > 0.5).count();
        // Pauses *inside* the speech, not just leading/trailing silence.
        let gaps = env[first..last].iter().filter(|l| **l < 0.2).count();
        assert!(peaks > env.len() / 3 && gaps >= 2, "peaks {peaks} gaps {gaps} of {}", env.len());
    }

    #[test]
    fn silence_detector_fires_once_after_continuous_quiet() {
        let blocks = (SILENCE_STOP.as_millis() as u64 / LEVEL_BLOCK_MS) as usize; // 1200
        let mut d = SilenceDetector::default();
        assert!((0..blocks - 1).all(|_| !d.push(0.05)));
        assert!(!d.push(0.3)); // speech resets the count
        assert!((0..blocks - 1).all(|_| !d.push(SILENCE_LEVEL - 0.001)));
        assert!(!d.push(SILENCE_LEVEL)); // at the threshold is not silence
        assert!((0..blocks - 1).all(|_| !d.push(0.0)));
        assert!(d.push(0.0));
        assert!((0..blocks * 2).all(|_| !d.push(0.0))); // only once
    }

    #[test]
    fn tones_are_short_soft_and_click_free() {
        let t = tone(880.0, 1320.0, 90);
        assert_eq!(t.len(), 16 * 90);
        let peak = t.iter().fold(0.0f32, |m, x| m.max(x.abs()));
        assert!(peak > 0.15 && peak <= 0.2, "{peak}");
        assert!(t[0].abs() < 0.01 && t[t.len() - 1].abs() < 0.01);
        assert_eq!(tone(1320.0, 880.0, 120).len(), 16 * 120);
    }

    #[test]
    fn recorder_is_send() {
        fn assert_send<T: Send>() {}
        assert_send::<Recorder>();
    }
}
