-- Pre-computed waveform peaks for instant waveform rendering
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS waveform_peaks jsonb;

-- Persisted AAC transcode file name (eliminates repeated ALAC transcoding)
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS aac_file_name text;

-- Audio codec detected at upload time (skip format probe)
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS audio_codec text;
