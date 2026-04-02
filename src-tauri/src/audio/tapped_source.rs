use ringbuf::traits::Producer;
use ringbuf::HeapProd;
use rodio::Source;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Wraps any `rodio::Source<Item = f32>` and copies each sample to a ring buffer
/// for FFT consumption. Non-blocking — drops samples if the ring buffer is full.
pub struct TappedSource<S>
where
    S: Source<Item = f32>,
{
    inner: S,
    producer: HeapProd<f32>,
    samples_played: Arc<AtomicU64>,
}

impl<S> TappedSource<S>
where
    S: Source<Item = f32>,
{
    pub fn new(inner: S, producer: HeapProd<f32>, samples_played: Arc<AtomicU64>) -> Self {
        Self {
            inner,
            producer,
            samples_played,
        }
    }
}

impl<S> Iterator for TappedSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.inner.next()?;
        // Non-blocking push — drop if full
        let _ = self.producer.try_push(sample);
        self.samples_played.fetch_add(1, Ordering::Relaxed);
        Some(sample)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

impl<S> Source for TappedSource<S>
where
    S: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.inner.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}
