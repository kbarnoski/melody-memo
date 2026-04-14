-- Lock down recordings table SELECT to owner only.
-- Previously a permissive SELECT policy was leaking other users' recordings
-- into /library, /insights, /compare, journey selectors, and the create-
-- journey track picker. The client code now explicitly filters by user_id
-- everywhere as defense-in-depth, but the database is the real source of
-- truth — RLS must enforce ownership.
--
-- Exceptions for cross-user public content:
--   - is_featured = true (curated installation content)
--   - share_token IS NOT NULL (recordings explicitly shared via link)

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Drop any existing SELECT policies so we can rebuild cleanly.
-- Names below are the conventional ones; the IF EXISTS guards make this safe.
DROP POLICY IF EXISTS "Anyone can view recordings" ON recordings;
DROP POLICY IF EXISTS "Public read access" ON recordings;
DROP POLICY IF EXISTS "recordings_select_all" ON recordings;
DROP POLICY IF EXISTS "recordings_select_owner" ON recordings;
DROP POLICY IF EXISTS "recordings_select_public" ON recordings;
DROP POLICY IF EXISTS "Enable read access for all users" ON recordings;

-- Owner SELECT — the default path for everything in /library, /insights, etc.
CREATE POLICY "recordings_select_owner" ON recordings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Public SELECT — featured content + share tokens. Allows anonymous and
-- authenticated users to fetch recordings that have been explicitly opted
-- into cross-user visibility.
CREATE POLICY "recordings_select_public" ON recordings
  FOR SELECT
  TO authenticated, anon
  USING (
    is_featured = true
    OR share_token IS NOT NULL
  );

-- Owner INSERT — users can only insert recordings they own.
DROP POLICY IF EXISTS "recordings_insert_owner" ON recordings;
CREATE POLICY "recordings_insert_owner" ON recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner UPDATE — users can only update their own recordings.
DROP POLICY IF EXISTS "recordings_update_owner" ON recordings;
CREATE POLICY "recordings_update_owner" ON recordings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner DELETE — users can only delete their own recordings.
DROP POLICY IF EXISTS "recordings_delete_owner" ON recordings;
CREATE POLICY "recordings_delete_owner" ON recordings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Analyses table: same ownership model via recording join ───
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analyses_select_all" ON analyses;
DROP POLICY IF EXISTS "analyses_select_owner" ON analyses;
DROP POLICY IF EXISTS "analyses_select_public" ON analyses;
DROP POLICY IF EXISTS "Anyone can view analyses" ON analyses;
DROP POLICY IF EXISTS "Public read access" ON analyses;
DROP POLICY IF EXISTS "Enable read access for all users" ON analyses;

CREATE POLICY "analyses_select_owner" ON analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.user_id = auth.uid()
    )
  );

-- Public analyses for featured / shared recordings
CREATE POLICY "analyses_select_public" ON analyses
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND (recordings.is_featured = true OR recordings.share_token IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "analyses_insert_owner" ON analyses;
CREATE POLICY "analyses_insert_owner" ON analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "analyses_update_owner" ON analyses;
CREATE POLICY "analyses_update_owner" ON analyses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "analyses_delete_owner" ON analyses;
CREATE POLICY "analyses_delete_owner" ON analyses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = analyses.recording_id
        AND recordings.user_id = auth.uid()
    )
  );
