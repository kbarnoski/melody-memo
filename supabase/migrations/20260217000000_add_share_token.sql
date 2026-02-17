-- Add share_token column for shareable recording links
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Allow anonymous read access to shared recordings (via share_token)
CREATE POLICY "Anyone can view shared recordings"
  ON recordings
  FOR SELECT
  USING (share_token IS NOT NULL);

-- Allow anonymous read access to analyses of shared recordings
CREATE POLICY "Anyone can view analyses of shared recordings"
  ON analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.share_token IS NOT NULL
    )
  );
