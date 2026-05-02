-- Adds ai_enabled column to journeys so creators can mark a journey as
-- viz-only (shaders without AI imagery). Defaults to true so existing rows
-- keep their current behavior; the create form now exposes the toggle.

alter table journeys
  add column if not exists ai_enabled boolean not null default true;

comment on column journeys.ai_enabled is
  'When false, this journey plays shaders only — skips AI image generation.';
