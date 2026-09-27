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
const LEVEL_INTERVAL: Duration = Duration::from_millis(33);

/// Names of available input devices (for the settings picker).
pub fn list_input_devices() -> Result<Vec<String>> {
    let host = cpal::default_host();
    Ok(host
        .input_devices()?
        .filter_map(|d| d.description().ok().map(|x| x.name().to_owned()))
        .collect())
}

/// True when no 30 ms window reaches speech level.
///
/// ponytail: fixed RMS threshold (0.005 ≈ -46 dBFS); a real VAD if quiet mics get dropped.
pub fn is_probably_silent(samples: &[f32]) -> bool {
    !samples.chunks(480).any(|w| rms(w) > 0.005)
}

fn rms(s: &[f32]) -> f32 {
    if s.is_empty() {
        return 0.0;
    }
    (s.iter().map(|x| x * x).sum::<f32>() / s.len() as f32).sqrt()
}

/// Map RMS to 0..1 on a dBFS scale (-60 dB → 0, 0 dB → 1). Loudness is perceived
/// logarithmically; a linear map leaves the pill waveform flat for normal speech (~-30 dBFS).
fn level(rms: f32) -> f32 {
    ((20.0 * rms.max(1e-9).log10() + 60.0) / 60.0).clamp(0.0, 1.0)
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
        on_level: impl Fn(f32) + Send + 'static,
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

fn open_stream(name: Option<&str>, on_level: Box<dyn Fn(f32) + Send>) -> Result<Opened> {
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
        sum_sq: 0.0,
        n: 0,
        last: Instant::now(),
    };
    let cfg = config.config();
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => build::<f32>(&device, cfg, sink),
        cpal::SampleFormat::I16 => build::<i16>(&device, cfg, sink),
        cpal::SampleFormat::U16 => build::<u16>(&device, cfg, sink),
        f => return Err(anyhow!("unsupported microphone sample format {f:?}")),
    }?;
    stream.play().context("failed to start microphone")?;
    Ok((stream, buf, channels, rate))
}

struct Sink {
    buf: Arc<Mutex<Vec<f32>>>,
    cap: usize,
    on_level: Box<dyn Fn(f32) + Send>,
    sum_sq: f32,
    n: usize,
    last: Instant,
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
                let v = f32::from_sample(s);
                sink.sum_sq += v * v;
            }
            sink.n += data.len();
            if sink.last.elapsed() >= LEVEL_INTERVAL && sink.n > 0 {
                (sink.on_level)(level((sink.sum_sq / sink.n as f32).sqrt()));
                sink.sum_sq = 0.0;
                sink.n = 0;
                sink.last = Instant::now();
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
        assert!(is_probably_silent(&vec![0.0; 16_000]));
        assert!(is_probably_silent(&vec![0.001; 16_000]));
        let mut speech = vec![0.0; 16_000];
        for (i, s) in speech[8_000..8_960].iter_mut().enumerate() {
            *s = 0.2 * (i as f32 * 0.1).sin();
        }
        assert!(!is_probably_silent(&speech));
    }

    #[test]
    fn level_mapping() {
        assert_eq!(level(0.0), 0.0);
        assert_eq!(level(1.0), 1.0);
        assert!((level(0.001) - 0.0).abs() < 1e-5); // -60 dBFS
        assert!((level(0.031_622_8) - 0.5).abs() < 1e-3); // -30 dBFS
    }

    #[test]
    fn recorder_is_send() {
        fn assert_send<T: Send>() {}
        assert_send::<Recorder>();
    }
}
