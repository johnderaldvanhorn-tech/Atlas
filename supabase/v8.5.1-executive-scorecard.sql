-- ATLAS 8.5.1 Executive Scorecard
create table if not exists public.executive_scorecard (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  team text, category text, owner text, unit text not null default 'number',
  target_value numeric not null default 0, current_value numeric not null default 0, average_value numeric not null default 0,
  status text not null default 'On Target', notes text, display_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.executive_scorecard enable row level security;
drop policy if exists "executive_scorecard_all" on public.executive_scorecard;
create policy "executive_scorecard_all" on public.executive_scorecard for all to anon, authenticated using (true) with check (true);
insert into public.executive_scorecard (metric_name,team,category,owner,unit,target_value,current_value,average_value,status,display_order)
select 'Software MRR','Product & Technology','Financial','CTO','currency',150000,133500,98571,'Needs Attention',1
where not exists (select 1 from public.executive_scorecard where lower(metric_name)=lower('Software MRR'));
insert into public.executive_scorecard (metric_name,team,category,owner,unit,target_value,current_value,average_value,status,display_order)
select 'Current Connections','Product & Technology','Customer Growth','CTO','number',4200,3793,2775,'Needs Attention',2
where not exists (select 1 from public.executive_scorecard where lower(metric_name)=lower('Current Connections'));
