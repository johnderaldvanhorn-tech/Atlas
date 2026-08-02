-- ATLAS v8.5.2: weekly scorecard history
create table if not exists public.executive_scorecard_history (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.executive_scorecard(id) on delete cascade,
  period_end date not null,
  value numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(metric_id, period_end)
);
alter table public.executive_scorecard_history enable row level security;
drop policy if exists "executive_scorecard_history_all" on public.executive_scorecard_history;
create policy "executive_scorecard_history_all" on public.executive_scorecard_history for all to anon, authenticated using (true) with check (true);
create index if not exists executive_scorecard_history_metric_period_idx on public.executive_scorecard_history(metric_id, period_end desc);
