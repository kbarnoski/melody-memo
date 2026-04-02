use ringbuf::traits::{Consumer, Observer};
use ringbuf::HeapCons;
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;

const FFT_SIZE: usize = 256;
const BIN_COUNT: usize = FFT_SIZE / 2; // 128 bins
const MIN_DB: f32 = -100.0;
const DB_RANGE: f32 = 70.0; // -100 to -30 dB, matching Web Audio AnalyserNode defaults
const SMOOTHING: f32 = 0.8; // Matches AnalyserNode.smoothingTimeConstant

#[derive(Clone, serde::Serialize)]
pub struct AudioDataPayload {
    pub bins: Vec<u8>,
    #[serde(rename = "currentTime")]
    pub current_time: f64,
    pub duration: f64,
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
}

/// Precomputed Hann window coefficients
fn hann_window() -> [f32; FFT_SIZE] {
    let mut window = [0.0f32; FFT_SIZE];
    for i in 0..FFT_SIZE {
        window[i] =
            0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32).cos());
    }
    window
}

/// Runs the FFT analysis thread at ~60Hz.
/// Reads samples from the ring buffer consumer, applies a Hann window,
/// performs a 256-point FFT, and emits AudioDataPayload via Tauri Channel.
pub fn run_fft_thread(
    mut consumer: HeapCons<f32>,
    channel: Channel<AudioDataPayload>,
    samples_played: Arc<AtomicU64>,
    sample_rate: Arc<AtomicU64>,
    duration_secs: Arc<parking_lot::Mutex<f64>>,
    is_playing: Arc<AtomicBool>,
    stop_signal: Arc<AtomicBool>,
    channels: Arc<AtomicU64>,
) {
    let window = hann_window();
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);

    let mut smoothed = vec![0.0f32; BIN_COUNT];
    let mut scratch = vec![Complex::new(0.0, 0.0); FFT_SIZE];
    let mut input_buf = vec![0.0f32; FFT_SIZE];

    loop {
        if stop_signal.load(Ordering::Relaxed) {
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(16)); // ~60Hz

        // Read available samples, keep last FFT_SIZE
        let available = consumer.occupied_len();
        if available > 0 {
            let mut temp = vec![0.0f32; available];
            let read = consumer.pop_slice(&mut temp);
            if read >= FFT_SIZE {
                input_buf.copy_from_slice(&temp[read - FFT_SIZE..read]);
            } else if read > 0 {
                // Shift existing and append new
                let shift = FFT_SIZE - read;
                input_buf.copy_within(read.., 0);
                input_buf[shift..].copy_from_slice(&temp[..read]);
            }
        }

        // Apply Hann window and prepare complex input
        let mut fft_input: Vec<Complex<f32>> = input_buf
            .iter()
            .zip(window.iter())
            .map(|(s, w)| Complex::new(s * w, 0.0))
            .collect();

        fft.process_with_scratch(&mut fft_input, &mut scratch);

        // Take magnitude of first BIN_COUNT bins, convert to dB, then byte scale
        for i in 0..BIN_COUNT {
            let magnitude = fft_input[i].norm();
            // Convert to dB (avoid log of 0)
            let db = if magnitude > 1e-10 {
                20.0 * magnitude.log10()
            } else {
                MIN_DB
            };

            // Scale to 0-255 matching Web Audio API formula
            let normalized = (db - MIN_DB) / DB_RANGE;
            let byte_val = (normalized * 255.0).clamp(0.0, 255.0);

            // Exponential smoothing
            smoothed[i] = SMOOTHING * smoothed[i] + (1.0 - SMOOTHING) * byte_val;
        }

        let bins: Vec<u8> = smoothed.iter().map(|v| *v as u8).collect();

        let sr = sample_rate.load(Ordering::Relaxed) as f64;
        let ch = channels.load(Ordering::Relaxed) as f64;
        let played = samples_played.load(Ordering::Relaxed) as f64;
        let current_time = if sr > 0.0 && ch > 0.0 {
            played / (sr * ch)
        } else {
            0.0
        };

        let dur = *duration_secs.lock();
        let playing = is_playing.load(Ordering::Relaxed);

        let payload = AudioDataPayload {
            bins,
            current_time,
            duration: dur,
            is_playing: playing,
        };

        if channel.send(payload).is_err() {
            // Channel closed — WebView disconnected
            break;
        }
    }
}
