-- Resonance Database Schema
-- Run this in the Supabase SQL Editor

-- ============================================
-- Phase 1: Recordings
-- ============================================

create table recordings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  file_name text not null,
  audio_url text not null,
  duration real,
  file_size integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table recordings enable row level security;

create policy "Users can view own recordings"
  on recordings for select using (auth.uid() = user_id);

create policy "Users can insert own recordings"
  on recordings for insert with check (auth.uid() = user_id);

create policy "Users can update own recordings"
  on recordings for update using (auth.uid() = user_id);

create policy "Users can delete own recordings"
  on recordings for delete using (auth.uid() = user_id);

-- V2: Preserve original file date
alter table recordings add column if not exists recorded_at timestamptz;

-- V2: Markers (timestamp notes on waveform)
create table if not exists markers (
  id uuid default gen_random_uuid() primary key,
  recording_id uuid references recordings(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  time real not null,
  label text not null,
  color text default '#primary',
  created_at timestamptz default now()
);

alter table markers enable row level security;

create policy "Users can view own markers"
  on markers for select using (auth.uid() = user_id);

create policy "Users can insert own markers"
  on markers for insert with check (auth.uid() = user_id);

create policy "Users can update own markers"
  on markers for update using (auth.uid() = user_id);

create policy "Users can delete own markers"
  on markers for delete using (auth.uid() = user_id);

-- V2: Analysis teaching summary
alter table analyses add column if not exists summary jsonb;

-- ============================================
-- Phase 2: Analyses
-- ============================================

create table analyses (
  id uuid default gen_random_uuid() primary key,
  recording_id uuid references recordings(id) on delete cascade not null unique,
  status text default 'pending',
  key_signature text,
  tempo real,
  time_signature text,
  chords jsonb default '[]',
  notes jsonb default '[]',
  midi_data jsonb,
  created_at timestamptz default now()
);

alter table analyses enable row level security;

create policy "Users can view own analyses"
  on analyses for select using (
    exists (select 1 from recordings where recordings.id = analyses.recording_id and recordings.user_id = auth.uid())
  );

create policy "Users can insert own analyses"
  on analyses for insert with check (
    exists (select 1 from recordings where recordings.id = analyses.recording_id and recordings.user_id = auth.uid())
  );

create policy "Users can update own analyses"
  on analyses for update using (
    exists (select 1 from recordings where recordings.id = analyses.recording_id and recordings.user_id = auth.uid())
  );

-- ============================================
-- Phase 3: Chat Messages
-- ============================================

create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  recording_id uuid references recordings(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;

create policy "Users can view own chat messages"
  on chat_messages for select using (auth.uid() = user_id);

create policy "Users can insert own chat messages"
  on chat_messages for insert with check (auth.uid() = user_id);

-- ============================================
-- Phase 4: Tags
-- ============================================

create table tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text default 'blue',
  created_at timestamptz default now()
);

alter table tags enable row level security;

create policy "Users can view own tags"
  on tags for select using (auth.uid() = user_id);

create policy "Users can insert own tags"
  on tags for insert with check (auth.uid() = user_id);

create policy "Users can delete own tags"
  on tags for delete using (auth.uid() = user_id);

create table recording_tags (
  recording_id uuid references recordings(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  primary key (recording_id, tag_id)
);

alter table recording_tags enable row level security;

create policy "Users can view own recording tags"
  on recording_tags for select using (
    exists (select 1 from recordings where recordings.id = recording_tags.recording_id and recordings.user_id = auth.uid())
  );

create policy "Users can insert own recording tags"
  on recording_tags for insert with check (
    exists (select 1 from recordings where recordings.id = recording_tags.recording_id and recordings.user_id = auth.uid())
  );

create policy "Users can delete own recording tags"
  on recording_tags for delete using (
    exists (select 1 from recordings where recordings.id = recording_tags.recording_id and recordings.user_id = auth.uid())
  );

-- ============================================
-- Phase 4: Collections
-- ============================================

create table collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

alter table collections enable row level security;

create policy "Users can view own collections"
  on collections for select using (auth.uid() = user_id);

create policy "Users can insert own collections"
  on collections for insert with check (auth.uid() = user_id);

create policy "Users can update own collections"
  on collections for update using (auth.uid() = user_id);

create policy "Users can delete own collections"
  on collections for delete using (auth.uid() = user_id);

create table collection_recordings (
  collection_id uuid references collections(id) on delete cascade not null,
  recording_id uuid references recordings(id) on delete cascade not null,
  position integer default 0,
  primary key (collection_id, recording_id)
);

alter table collection_recordings enable row level security;

create policy "Users can view own collection recordings"
  on collection_recordings for select using (
    exists (select 1 from collections where collections.id = collection_recordings.collection_id and collections.user_id = auth.uid())
  );

create policy "Users can insert own collection recordings"
  on collection_recordings for insert with check (
    exists (select 1 from collections where collections.id = collection_recordings.collection_id and collections.user_id = auth.uid())
  );

create policy "Users can update own collection recordings"
  on collection_recordings for update using (
    exists (select 1 from collections where collections.id = collection_recordings.collection_id and collections.user_id = auth.uid())
  );

create policy "Users can delete own collection recordings"
  on collection_recordings for delete using (
    exists (select 1 from collections where collections.id = collection_recordings.collection_id and collections.user_id = auth.uid())
  );

-- ============================================
-- Full-text search on recordings
-- ============================================

create index recordings_title_search on recordings using gin (to_tsvector('english', title));

-- ============================================
-- Storage bucket (run separately if needed)
-- ============================================
-- insert into storage.buckets (id, name, public) values ('recordings', 'recordings', true);
-- create policy "Users can upload recordings" on storage.objects for insert with check (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Anyone can read recordings" on storage.objects for select using (bucket_id = 'recordings');
