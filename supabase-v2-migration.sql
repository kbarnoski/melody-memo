-- Resonance V2 Migration
-- Run this in the Supabase SQL Editor

-- 1. Add recorded_at column to recordings
alter table recordings add column if not exists recorded_at timestamptz;

-- 2. Add summary column to analyses
alter table analyses add column if not exists summary jsonb;

-- 3. Create markers table
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

-- RLS policies for markers
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own markers' and tablename = 'markers') then
    create policy "Users can view own markers" on markers for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert own markers' and tablename = 'markers') then
    create policy "Users can insert own markers" on markers for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update own markers' and tablename = 'markers') then
    create policy "Users can update own markers" on markers for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can delete own markers' and tablename = 'markers') then
    create policy "Users can delete own markers" on markers for delete using (auth.uid() = user_id);
  end if;
end $$;
