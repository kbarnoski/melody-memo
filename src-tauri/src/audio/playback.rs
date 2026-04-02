use crate::audio::tapped_source::TappedSource;
use ringbuf::traits::Split;
use ringbuf::HeapCons;
use ringbuf::HeapRb;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

/// Commands sent from the main thread to the audio playback thread.
pub enum AudioCommand {
    Load {
        path: String,
        /// Ring buffer consumer is passed back via this channel
        consumer_tx: crossbeam_channel::Sender<HeapCons<f32>>,
        /// Shared sample counter reset on load
        samples_played: Arc<AtomicU64>,
        sample_rate: Arc<AtomicU64>,
        channels: Arc<AtomicU64>,
        duration_secs: Arc<parking_lot::Mutex<f64>>,
    },
    Play,
    Pause,
    Stop,
    SetVolume(f32),
    Seek {
        position_secs: f64,
        /// Same shared state for rebuilding the pipeline
        samples_played: Arc<AtomicU64>,
        sample_rate: Arc<AtomicU64>,
        channels: Arc<AtomicU64>,
        duration_secs: Arc<parking_lot::Mutex<f64>>,
        consumer_tx: crossbeam_channel::Sender<HeapCons<f32>>,
    },
    Shutdown,
}

/// Runs the audio playback thread. Owns the rodio OutputStream and Sink.
pub fn run_playback_thread(
    rx: crossbeam_channel::Receiver<AudioCommand>,
    is_playing: Arc<AtomicBool>,
    on_ended: Arc<dyn Fn() + Send + Sync>,
) {
    // Create the output stream — must stay alive for the entire thread lifetime
    let (_stream, stream_handle): (OutputStream, OutputStreamHandle) =
        match OutputStream::try_default() {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to open audio output: {}", e);
                return;
            }
        };

    let mut sink: Option<Sink> = None;
    let mut current_volume: f32 = 1.0;
    let mut current_path: Option<String> = None;

    loop {
        // Check if the sink has finished playing (track ended)
        if let Some(ref s) = sink {
            if s.empty() && is_playing.load(Ordering::Relaxed) {
                is_playing.store(false, Ordering::Relaxed);
                on_ended();
            }
        }

        match rx.recv_timeout(std::time::Duration::from_millis(50)) {
            Ok(AudioCommand::Load {
                path,
                consumer_tx,
                samples_played,
                sample_rate,
                channels,
                duration_secs,
            }) => {
                // Stop any current playback
                if let Some(s) = sink.take() {
                    s.stop();
                }

                match load_file_to_sink(
                    &path,
                    &stream_handle,
                    samples_played,
                    sample_rate.clone(),
                    channels.clone(),
                    duration_secs.clone(),
                    current_volume,
                ) {
                    Ok((new_sink, consumer)) => {
                        let _ = consumer_tx.send(consumer);
                        // Start paused — the Play command will start it
                        new_sink.pause();
                        sink = Some(new_sink);
                        current_path = Some(path);
                        is_playing.store(false, Ordering::Relaxed);
                        log::info!("Audio loaded, sample_rate={}, channels={}",
                            sample_rate.load(Ordering::Relaxed),
                            channels.load(Ordering::Relaxed));
                    }
                    Err(e) => {
                        log::error!("Failed to load audio file: {}", e);
                        let _ = consumer_tx.send(HeapRb::new(1).split().1);
                    }
                }
            }

            Ok(AudioCommand::Play) => {
                if let Some(ref s) = sink {
                    s.play();
                    is_playing.store(true, Ordering::Relaxed);
                }
            }

            Ok(AudioCommand::Pause) => {
                if let Some(ref s) = sink {
                    s.pause();
                    is_playing.store(false, Ordering::Relaxed);
                }
            }

            Ok(AudioCommand::Stop) => {
                if let Some(s) = sink.take() {
                    s.stop();
                }
                is_playing.store(false, Ordering::Relaxed);
                current_path = None;
            }

            Ok(AudioCommand::SetVolume(vol)) => {
                current_volume = vol;
                if let Some(ref s) = sink {
                    s.set_volume(vol);
                }
            }

            Ok(AudioCommand::Seek {
                position_secs,
                samples_played,
                sample_rate,
                channels,
                duration_secs,
                consumer_tx,
            }) => {
                let was_playing = is_playing.load(Ordering::Relaxed);

                if let Some(s) = sink.take() {
                    s.stop();
                }

                if let Some(ref path) = current_path {
                    match load_file_with_seek(
                        path,
                        &stream_handle,
                        position_secs,
                        samples_played,
                        sample_rate,
                        channels,
                        duration_secs,
                        current_volume,
                    ) {
                        Ok((new_sink, consumer)) => {
                            let _ = consumer_tx.send(consumer);
                            if was_playing {
                                new_sink.play();
                                is_playing.store(true, Ordering::Relaxed);
                            } else {
                                new_sink.pause();
                            }
                            sink = Some(new_sink);
                        }
                        Err(e) => {
                            log::error!("Seek failed: {}", e);
                            let _ = consumer_tx.send(HeapRb::new(1).split().1);
                        }
                    }
                }
            }

            Ok(AudioCommand::Shutdown) => {
                if let Some(s) = sink.take() {
                    s.stop();
                }
                break;
            }

            Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                // Normal timeout — loop back to check sink status
            }
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                break;
            }
        }
    }
}

/// Ring buffer size — enough for ~85ms at 48kHz stereo
const RING_BUFFER_SIZE: usize = 8192;

fn load_file_to_sink(
    path: &str,
    stream_handle: &OutputStreamHandle,
    samples_played: Arc<AtomicU64>,
    sample_rate: Arc<AtomicU64>,
    channels: Arc<AtomicU64>,
    duration_secs: Arc<parking_lot::Mutex<f64>>,
    volume: f32,
) -> Result<(Sink, HeapCons<f32>), String> {
    let file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
    let reader = BufReader::new(file);
    let decoder = Decoder::new(reader).map_err(|e| format!("Decode error: {}", e))?;

    // Capture metadata before consuming the decoder
    let sr = decoder.sample_rate();
    let ch = decoder.channels();
    let dur: f64 = decoder
        .total_duration()
        .map(|d: std::time::Duration| d.as_secs_f64())
        .unwrap_or(0.0);

    sample_rate.store(sr as u64, Ordering::Relaxed);
    channels.store(ch as u64, Ordering::Relaxed);
    *duration_secs.lock() = dur;
    samples_played.store(0, Ordering::Relaxed);

    // Convert i16 samples to f32
    let float_source = decoder.convert_samples::<f32>();

    // Create ring buffer
    let rb = HeapRb::<f32>::new(RING_BUFFER_SIZE);
    let (producer, consumer) = rb.split();

    let tapped = TappedSource::new(float_source, producer, samples_played);

    let sink = Sink::try_new(stream_handle).map_err(|e| format!("Sink error: {}", e))?;
    sink.set_volume(volume);
    sink.append(tapped);

    Ok((sink, consumer))
}

fn load_file_with_seek(
    path: &str,
    stream_handle: &OutputStreamHandle,
    position_secs: f64,
    samples_played: Arc<AtomicU64>,
    sample_rate: Arc<AtomicU64>,
    channels: Arc<AtomicU64>,
    duration_secs: Arc<parking_lot::Mutex<f64>>,
    volume: f32,
) -> Result<(Sink, HeapCons<f32>), String> {
    let file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
    let reader = BufReader::new(file);
    let decoder = Decoder::new(reader).map_err(|e| format!("Decode error: {}", e))?;

    let sr = decoder.sample_rate();
    let ch = decoder.channels();
    let dur: f64 = decoder
        .total_duration()
        .map(|d: std::time::Duration| d.as_secs_f64())
        .unwrap_or(0.0);

    sample_rate.store(sr as u64, Ordering::Relaxed);
    channels.store(ch as u64, Ordering::Relaxed);
    *duration_secs.lock() = dur;

    // Calculate how many samples to skip for the seek position
    let samples_to_skip = (position_secs * sr as f64 * ch as f64) as u64;
    samples_played.store(samples_to_skip, Ordering::Relaxed);

    // Convert i16 samples to f32
    let float_source = decoder.convert_samples::<f32>();

    let rb = HeapRb::<f32>::new(RING_BUFFER_SIZE);
    let (producer, consumer) = rb.split();

    let tapped = TappedSource::new(float_source, producer, samples_played);

    // Skip samples to reach the seek position
    let skip_source = tapped.skip_duration(std::time::Duration::from_secs_f64(position_secs));

    let sink = Sink::try_new(stream_handle).map_err(|e| format!("Sink error: {}", e))?;
    sink.set_volume(volume);
    sink.append(skip_source);

    Ok((sink, consumer))
}
