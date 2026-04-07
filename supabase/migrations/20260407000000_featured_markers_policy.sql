-- Allow anyone to view markers (cue points) on featured recordings
CREATE POLICY "Anyone can view markers of featured recordings"
  ON markers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = markers.recording_id
      AND recordings.is_featured = true
    )
  );
