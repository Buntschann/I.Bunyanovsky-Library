-- Supabase SQL Editorで実行してください。

create extension if not exists pgcrypto;

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  media_type text not null default 'CD',
  title text not null,
  artist text,
  release_year integer,
  label text,
  catalog_no text,
  disc_count integer not null default 1,
  composer text,
  conductor text,
  performers text,
  ensemble text,
  genre text,
  location text,
  quantity integer not null default 1,
  tags text[],
  notes text,
  needs_review boolean not null default false,
  musicbrainz_release_id text,
  operator_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_library_barcode on public.library_items(barcode);
create index if not exists idx_library_title on public.library_items(title);
create index if not exists idx_library_genre on public.library_items(genre);
create index if not exists idx_library_needs_review on public.library_items(needs_review);

alter table public.library_items enable row level security;

drop policy if exists "Authenticated users can read" on public.library_items;
create policy "Authenticated users can read"
on public.library_items
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert" on public.library_items;
create policy "Authenticated users can insert"
on public.library_items
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update" on public.library_items;
create policy "Authenticated users can update"
on public.library_items
for update
to authenticated
using (true)
with check (true);

-- 物理削除はv1.0ではアプリから提供しません。
-- 必要になったら管理者専用ポリシーを追加してください。
