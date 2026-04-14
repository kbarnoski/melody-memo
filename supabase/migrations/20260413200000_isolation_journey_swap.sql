-- One-shot data migration: rebuild the Isolation journey on a different
-- library track and delete the 08_Isolation recording entirely.
--
-- This runs server-side as the postgres role (bypasses RLS), which is the
-- only way to do this from a CLI session — the alternative was a custom
-- API route + a manual DevTools fetch which the user explicitly rejected.
--
-- Strategy: clone the existing Isolation journey row with a new recording_id
-- pointing at the OTHER Isolation library track, then delete the old journey
-- and the 08_Isolation recording (DB row + storage object). Preserves the
-- story_text / theme / phases the user said they liked.
--
-- Safe to re-run: wrapped in a DO block that checks state and raises if
-- nothing matches.

DO $$
DECLARE
  v_old_journey_id uuid;
  v_user_id uuid;
  v_eight_rec_id uuid;
  v_eight_file_name text;
  v_other_rec_id uuid;
  v_other_rec_title text;
BEGIN
  -- 1. Find the most recent Isolation journey
  SELECT id, user_id INTO v_old_journey_id, v_user_id
  FROM journeys
  WHERE name ILIKE '%isolation%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_old_journey_id IS NULL THEN
    RAISE NOTICE 'No Isolation journey found — nothing to do';
    RETURN;
  END IF;

  RAISE NOTICE 'Found Isolation journey % owned by %', v_old_journey_id, v_user_id;

  -- 2. Find the 08_Isolation recording owned by the same user
  SELECT id, file_name INTO v_eight_rec_id, v_eight_file_name
  FROM recordings
  WHERE user_id = v_user_id
    AND title ~* '(^|[^0-9])0?8[_\s-]?isolation'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_eight_rec_id IS NULL THEN
    -- Looser match: any recording with "08" and "isolation"
    SELECT id, file_name INTO v_eight_rec_id, v_eight_file_name
    FROM recordings
    WHERE user_id = v_user_id
      AND title ILIKE '%08%'
      AND title ILIKE '%isolation%'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_eight_rec_id IS NULL THEN
    RAISE EXCEPTION '08_Isolation recording not found for user %', v_user_id;
  END IF;

  RAISE NOTICE 'Found 08_Isolation recording % (file: %)', v_eight_rec_id, v_eight_file_name;

  -- 3. Find the OTHER Isolation recording (not 08_) for the same user
  SELECT id, title INTO v_other_rec_id, v_other_rec_title
  FROM recordings
  WHERE user_id = v_user_id
    AND title ILIKE '%isolation%'
    AND id != v_eight_rec_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_other_rec_id IS NULL THEN
    RAISE EXCEPTION 'Other Isolation recording not found for user %', v_user_id;
  END IF;

  RAISE NOTICE 'Found other Isolation recording % (title: %)', v_other_rec_id, v_other_rec_title;

  -- 4. Clone the journey row with recording_id swapped to the other track
  INSERT INTO journeys (
    user_id, recording_id, name, subtitle, description, story_text,
    realm_id, phases, theme, audio_reactive, creator_name, local_image_urls,
    is_public
  )
  SELECT
    user_id, v_other_rec_id, name, subtitle, description, story_text,
    realm_id, phases, theme, audio_reactive, creator_name, local_image_urls,
    is_public
  FROM journeys
  WHERE id = v_old_journey_id;

  RAISE NOTICE 'Cloned journey with new recording_id %', v_other_rec_id;

  -- 5. Delete the old journey row
  DELETE FROM journeys WHERE id = v_old_journey_id;
  RAISE NOTICE 'Deleted old journey %', v_old_journey_id;

  -- 6. Delete the 08_Isolation recording row.
  -- NOTE: Supabase's storage.protect_delete trigger blocks direct DELETE
  -- from storage.objects in SQL. The storage file gets cleaned up by a
  -- separate step using the Storage API (see scripts/delete-08-isolation-file.mjs).
  -- The orphaned blob isn't user-visible because the library queries only
  -- show recordings table rows.
  DELETE FROM recordings WHERE id = v_eight_rec_id;
  RAISE NOTICE 'Deleted recording row % (storage object % needs separate cleanup)', v_eight_rec_id, v_eight_file_name;

  RAISE NOTICE 'Migration complete';
END $$;
