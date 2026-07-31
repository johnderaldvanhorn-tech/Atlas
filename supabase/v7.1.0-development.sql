-- Project Portfolio Planner v7.1.0
-- Software development work items
create table if not exists public.development_items (
  id uuid primary key default gen_random_uuid(),
  source_line integer,
  release text,
  start_date date,
  end_date date,
  area text,
  combined_type text not null default 'Other',
  title text not null,
  url text,
  assignees text,
  status text not null default 'Open',
  type text,
  size text,
  linked_pull_requests text,
  labels text,
  priority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists development_items_release_idx on public.development_items(release);
create index if not exists development_items_status_idx on public.development_items(status);
create index if not exists development_items_priority_idx on public.development_items(priority);
create index if not exists development_items_start_date_idx on public.development_items(start_date);
alter table public.development_items enable row level security;
drop policy if exists development_items_anon_all on public.development_items;
create policy development_items_anon_all on public.development_items for all to anon using (true) with check (true);
drop policy if exists development_items_authenticated_all on public.development_items;
create policy development_items_authenticated_all on public.development_items for all to authenticated using (true) with check (true);
