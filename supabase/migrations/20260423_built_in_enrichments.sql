-- Built-in journey phase-sequence enrichments.
--
-- The built-in journeys are defined in code (src/lib/journeys/journeys.ts),
-- but only Ghost has hand-authored aiPromptSequence arrays. Every other
-- built-in has a single aiPrompt per phase, which makes playback feel like
-- a slideshow. Rather than hand-write 17 × 6 sequences, we lazy-generate
-- them at runtime with Claude and cache them here — read-only for everyone,
-- admin-only for writes (the admin endpoint uses the service role).
--
-- Loader merges enrichment.phases[i].aiPromptSequence into the built-in
-- journey's phases[i] at playback time.

CREATE TABLE IF NOT EXISTS public.built_in_enrichments (
  journey_id text PRIMARY KEY,
  phases jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.built_in_enrichments ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (so every logged-in user gets rich
-- imagery for built-ins, not just admin).
DROP POLICY IF EXISTS "built_in_enrichments_read_all" ON public.built_in_enrichments;
CREATE POLICY "built_in_enrichments_read_all"
  ON public.built_in_enrichments FOR SELECT
  TO authenticated
  USING (true);

-- No direct writes via RLS — all upserts go through the server-side
-- admin backfill endpoint using the service role key.

CREATE INDEX IF NOT EXISTS idx_built_in_enrichments_updated_at
  ON public.built_in_enrichments (updated_at DESC);
