-- Adds optional photographer credit + dedication fields to journeys.
-- Used by photographer-collab journeys (e.g. Isolation, photographed by
-- Patrick Neeman) to surface a photo credit and a personal dedication on
-- the journey's intro and end overlays.

ALTER TABLE journeys ADD COLUMN IF NOT EXISTS photography_credit text;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS dedication text;

-- One-shot: credit Patrick Neeman on the Isolation journey and dedicate it
-- to him. There should be exactly one Isolation journey at this point (the
-- earlier 20260413200000 migration cloned the original onto a different
-- recording and deleted the old row).
UPDATE journeys
SET photography_credit = 'Patrick Neeman',
    dedication = 'For Patrick Neeman'
WHERE name ILIKE '%isolation%';
