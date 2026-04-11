-- 1. Profiles table
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles"
  on profiles for select using (true);

create policy "Users can manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Artist column on recordings
alter table recordings add column artist text;

-- 3. Creator name on journeys (denormalized for anonymous access on shared pages)
alter table journeys add column creator_name text;
