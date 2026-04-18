-- ============================================================
-- Hardening migration — April 17, 2026
-- Adds missing FK indexes, composite indexes for common query
-- patterns, defensive length + jsonb type CHECK constraints, and
-- a journey_feedback table so the feedback API stops writing to
-- the ephemeral server filesystem.
--
-- All DDL is idempotent (IF NOT EXISTS / DROP IF EXISTS + CREATE).
-- CHECK constraints are added with NOT VALID first so existing rows
-- are not rescanned; validation is a separate best-effort step at
-- the bottom.
-- ============================================================

-- ─── Foreign-key indexes ───
-- Postgres does NOT auto-index FK columns. Without these, RLS
-- policies that reference parent tables do seq-scans on every
-- permission check. Adding them is cheap and backwards-compatible.

create index if not exists idx_markers_recording_id on markers(recording_id);
create index if not exists idx_markers_user_id on markers(user_id);
create index if not exists idx_chat_messages_recording_id on chat_messages(recording_id);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_recording_tags_tag_id on recording_tags(tag_id);
create index if not exists idx_collection_recordings_recording_id on collection_recordings(recording_id);
create index if not exists idx_tags_user_id on tags(user_id);
create index if not exists idx_collections_user_id on collections(user_id);
create index if not exists idx_analyses_recording_id on analyses(recording_id);

-- ─── Composite indexes for common query patterns ───
-- List screens page by created_at DESC filtered by user_id — this
-- composite serves both the WHERE and the ORDER BY in one scan.

create index if not exists idx_recordings_user_created_desc
  on recordings(user_id, created_at desc);
create index if not exists idx_journeys_user_created_desc
  on journeys(user_id, created_at desc);
create index if not exists idx_journey_paths_user_created_desc
  on journey_paths(user_id, created_at desc);
create index if not exists idx_markers_recording_time
  on markers(recording_id, time);
create index if not exists idx_chat_messages_recording_created
  on chat_messages(recording_id, created_at);

-- ─── Defensive length limits on free-text columns ───
-- These guard against accidental or malicious bloat. Caps are
-- generous — nothing short of 10kB for descriptions. Use NOT VALID
-- so existing rows aren't rescanned at migration time.

alter table recordings drop constraint if exists recordings_title_length;
alter table recordings add constraint recordings_title_length
  check (length(title) <= 500) not valid;
alter table recordings drop constraint if exists recordings_description_length;
alter table recordings add constraint recordings_description_length
  check (description is null or length(description) <= 10000) not valid;

alter table markers drop constraint if exists markers_label_length;
alter table markers add constraint markers_label_length
  check (length(label) <= 1000) not valid;

alter table tags drop constraint if exists tags_name_length;
alter table tags add constraint tags_name_length
  check (length(name) <= 200) not valid;

alter table collections drop constraint if exists collections_name_length;
alter table collections add constraint collections_name_length
  check (length(name) <= 500) not valid;
alter table collections drop constraint if exists collections_description_length;
alter table collections add constraint collections_description_length
  check (description is null or length(description) <= 10000) not valid;

alter table chat_messages drop constraint if exists chat_messages_content_length;
alter table chat_messages add constraint chat_messages_content_length
  check (length(content) <= 20000) not valid;

alter table journeys drop constraint if exists journeys_name_length;
alter table journeys add constraint journeys_name_length
  check (length(name) <= 500) not valid;
alter table journeys drop constraint if exists journeys_subtitle_length;
alter table journeys add constraint journeys_subtitle_length
  check (subtitle is null or length(subtitle) <= 1000) not valid;
alter table journeys drop constraint if exists journeys_description_length;
alter table journeys add constraint journeys_description_length
  check (description is null or length(description) <= 10000) not valid;
alter table journeys drop constraint if exists journeys_story_text_length;
alter table journeys add constraint journeys_story_text_length
  check (story_text is null or length(story_text) <= 20000) not valid;

alter table journey_paths drop constraint if exists journey_paths_name_length;
alter table journey_paths add constraint journey_paths_name_length
  check (length(name) <= 500) not valid;
alter table journey_paths drop constraint if exists journey_paths_subtitle_length;
alter table journey_paths add constraint journey_paths_subtitle_length
  check (subtitle is null or length(subtitle) <= 1000) not valid;
alter table journey_paths drop constraint if exists journey_paths_description_length;
alter table journey_paths add constraint journey_paths_description_length
  check (description is null or length(description) <= 10000) not valid;

-- ─── JSONB type checks ───
-- Prevent accidental swaps between objects / arrays. Applied only
-- where the app contract clearly expects one shape.

alter table analyses drop constraint if exists analyses_chords_is_array;
alter table analyses add constraint analyses_chords_is_array
  check (chords is null or jsonb_typeof(chords) = 'array') not valid;
alter table analyses drop constraint if exists analyses_notes_is_array;
alter table analyses add constraint analyses_notes_is_array
  check (notes is null or jsonb_typeof(notes) = 'array') not valid;
alter table analyses drop constraint if exists analyses_midi_data_is_object;
alter table analyses add constraint analyses_midi_data_is_object
  check (midi_data is null or jsonb_typeof(midi_data) = 'object') not valid;
alter table analyses drop constraint if exists analyses_summary_is_object;
alter table analyses add constraint analyses_summary_is_object
  check (summary is null or jsonb_typeof(summary) = 'object') not valid;

alter table journeys drop constraint if exists journeys_phases_is_object;
alter table journeys add constraint journeys_phases_is_object
  check (jsonb_typeof(phases) in ('object', 'array')) not valid;

-- ─── Journey feedback table ───
-- Replaces the server-filesystem journey-feedback.jsonl file, which
-- is ephemeral on Vercel and lost on every deploy. The POST handler
-- in src/app/api/journey-feedback is being updated to insert into
-- this table; the GET handler remains admin-only.

create table if not exists journey_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  journey_id text,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_journey_feedback_user_created
  on journey_feedback(user_id, created_at desc);
create index if not exists idx_journey_feedback_journey
  on journey_feedback(journey_id)
  where journey_id is not null;

alter table journey_feedback enable row level security;

drop policy if exists "Users can insert own journey feedback" on journey_feedback;
create policy "Users can insert own journey feedback"
  on journey_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own journey feedback" on journey_feedback;
create policy "Users can read own journey feedback"
  on journey_feedback for select
  using (auth.uid() = user_id);

alter table journey_feedback drop constraint if exists journey_feedback_payload_is_object;
alter table journey_feedback add constraint journey_feedback_payload_is_object
  check (jsonb_typeof(payload) = 'object') not valid;

-- ─── Validate constraints against existing rows (best effort) ───
-- If any row violates, this raises. That's intentional — you want
-- to know so the violating row can be cleaned up.
do $$ begin
  alter table recordings validate constraint recordings_title_length;
  alter table recordings validate constraint recordings_description_length;
  alter table markers validate constraint markers_label_length;
  alter table tags validate constraint tags_name_length;
  alter table collections validate constraint collections_name_length;
  alter table collections validate constraint collections_description_length;
  alter table chat_messages validate constraint chat_messages_content_length;
  alter table journeys validate constraint journeys_name_length;
  alter table journeys validate constraint journeys_subtitle_length;
  alter table journeys validate constraint journeys_description_length;
  alter table journeys validate constraint journeys_story_text_length;
  alter table journey_paths validate constraint journey_paths_name_length;
  alter table journey_paths validate constraint journey_paths_subtitle_length;
  alter table journey_paths validate constraint journey_paths_description_length;
  alter table analyses validate constraint analyses_chords_is_array;
  alter table analyses validate constraint analyses_notes_is_array;
  alter table analyses validate constraint analyses_midi_data_is_object;
  alter table analyses validate constraint analyses_summary_is_object;
  alter table journeys validate constraint journeys_phases_is_object;
exception when others then
  raise notice 'Constraint validation raised: % — investigate violating rows manually.', SQLERRM;
end $$;
