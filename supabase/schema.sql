create extension if not exists pgcrypto;

create table if not exists projects (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text,
 division text,
 category text,
 status text default 'Proposed',
 champion text,
 executive_sponsor text,
 start_date date,
 target_date date,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);
create table if not exists project_estimates (
 project_id uuid primary key references projects(id) on delete cascade,
 hours numeric default 0, loaded_rate numeric default 120,
 external_cost numeric default 0, capex numeric default 0,
 uncertainty smallint default 2 check(uncertainty between 1 and 3),
 fte numeric default 1, allocation numeric default .5,
 gross_margin numeric default .35, annual_savings numeric default 0,
 year1_revenue numeric default 0, year2_revenue numeric default 0, year3_revenue numeric default 0
);
create table if not exists project_scores (
 project_id uuid primary key references projects(id) on delete cascade,
 project_type text default 'A' check(project_type in ('A','B','C')),
 cost_amount smallint default 1 check(cost_amount between 1 and 3),
 quadrant_score smallint default 2 check(quadrant_score between 1 and 4),
 impact numeric default 3, lift numeric default 3, strategic numeric default 3,
 customer numeric default 3, speed numeric default 3, feasibility numeric default 3,
 confidence numeric default 3, technical_risk numeric default 3,
 production_risk numeric default 3, market_risk numeric default 3
);
create table if not exists resources (
 id uuid primary key default gen_random_uuid(),
 name text not null, role text, department text,
 loaded_rate numeric default 120, hours_per_month numeric default 140,
 active boolean default true, created_at timestamptz default now()
);
create table if not exists project_assignments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid references projects(id) on delete cascade,
 resource_id uuid references resources(id) on delete cascade,
 estimated_hours numeric default 0, allocation numeric default .5,
 assignment_role text, start_month date, finish_month date,
 unique(project_id, resource_id)
);
create table if not exists project_schedule (
 id uuid primary key default gen_random_uuid(),
 project_id uuid references projects(id) on delete cascade,
 period_start date not null, marker text check(marker in ('S','X','E')),
 planned_hours numeric default 0, unique(project_id,period_start)
);

alter table project_scores add column if not exists quadrant_score smallint default 2 check(quadrant_score between 1 and 4);
alter table project_scores add column if not exists project_type text default 'A' check(project_type in ('A','B','C'));
alter table project_scores add column if not exists cost_amount smallint default 1 check(cost_amount between 1 and 3);

create or replace view project_portfolio_view as
select p.*, e.hours,e.loaded_rate,e.external_cost,e.capex,e.uncertainty,e.fte,e.allocation,e.gross_margin,e.annual_savings,e.year1_revenue,e.year2_revenue,e.year3_revenue,
s.project_type,s.cost_amount,s.quadrant_score,s.impact,s.lift,s.strategic,s.customer,s.speed,s.feasibility,s.confidence,s.technical_risk,s.production_risk,s.market_risk,
coalesce((select jsonb_agg(jsonb_build_object('resourceId',a.resource_id,'hours',a.estimated_hours,'allocation',a.allocation,'role',a.assignment_role,'startMonth',a.start_month,'finishMonth',a.finish_month)) from project_assignments a where a.project_id=p.id),'[]'::jsonb) assignments,
p.start_date as start_month
from projects p left join project_estimates e on e.project_id=p.id left join project_scores s on s.project_id=p.id;

alter table projects enable row level security;
alter table project_estimates enable row level security;
alter table project_scores enable row level security;
alter table resources enable row level security;
alter table project_assignments enable row level security;
alter table project_schedule enable row level security;

-- Prototype policies. Replace with organization-specific policies before production.
do $$ begin
 create policy "prototype projects" on projects for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "prototype estimates" on project_estimates for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "prototype scores" on project_scores for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "prototype resources" on resources for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "prototype assignments" on project_assignments for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "prototype schedule" on project_schedule for all to anon,authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;


-- v0.3 governance extension
create table if not exists project_governance (
 project_id uuid primary key references projects(id) on delete cascade,
 approval_stage text default 'Draft', decision_owner text, decision_date date, target_date date
);
create table if not exists project_milestones (
 id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade,
 name text not null, due_date date, status text default 'Planned'
);
create table if not exists project_dependencies (
 id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade,
 depends_on_project_id uuid references projects(id) on delete cascade, dependency_type text default 'Finish-to-Start',
 unique(project_id,depends_on_project_id)
);
create table if not exists project_risks (
 id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade,
 description text not null, severity text default 'Medium', mitigation text, status text default 'Open'
);
alter table project_governance enable row level security;
alter table project_milestones enable row level security;
alter table project_dependencies enable row level security;
alter table project_risks enable row level security;
do $$ begin create policy "prototype governance" on project_governance for all to anon,authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "prototype milestones" on project_milestones for all to anon,authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "prototype dependencies" on project_dependencies for all to anon,authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "prototype risks" on project_risks for all to anon,authenticated using (true) with check (true); exception when duplicate_object then null; end $$;

-- v0.4 execution management
create table if not exists public.project_execution (
  project_id uuid primary key references public.projects(id) on delete cascade,
  current_phase text not null default 'Discovery',
  phase_gate text not null default 'Not Submitted',
  percent_complete numeric not null default 0,
  health text not null default 'Green',
  actual_internal numeric not null default 0,
  actual_external numeric not null default 0,
  actual_capex numeric not null default 0,
  forecast_date date,
  status_summary text,
  updated_at timestamptz not null default now()
);
create table if not exists public.project_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  owner text,
  due_date date,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);
create table if not exists public.project_status_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null default current_date,
  health text not null default 'Green',
  summary text not null,
  created_at timestamptz not null default now()
);
alter table public.project_execution enable row level security;
alter table public.project_actions enable row level security;
alter table public.project_status_reports enable row level security;
drop policy if exists "prototype project_execution access" on public.project_execution;
create policy "prototype project_execution access" on public.project_execution for all using (true) with check (true);
drop policy if exists "prototype project_actions access" on public.project_actions;
create policy "prototype project_actions access" on public.project_actions for all using (true) with check (true);
drop policy if exists "prototype project_status_reports access" on public.project_status_reports;
create policy "prototype project_status_reports access" on public.project_status_reports for all using (true) with check (true);

-- v0.5 Sales/Marketing value levers
create table if not exists public.project_sales_marketing (
  project_id uuid primary key references public.projects(id) on delete cascade,
  unit_sales_score smallint not null default 1 check (unit_sales_score between 1 and 3),
  projected_units numeric not null default 30,
  average_selling_price numeric not null default 0,
  recurring_revenue_score smallint not null default 1 check (recurring_revenue_score between 1 and 3),
  connected_rate numeric not null default .10,
  monthly_recurring_base numeric not null default 68,
  speed_to_market_score smallint not null default 3 check (speed_to_market_score between 1 and 3),
  months_to_market numeric not null default 2,
  annual_price_lift numeric not null default 0,
  improves_conversion boolean not null default false,
  unlocks_kits boolean not null default false,
  extends_product_life boolean not null default false,
  increases_connect_rate boolean not null default false,
  unlocks_recurring boolean not null default false,
  stabilizes_billing boolean not null default false,
  deployable_current_platform boolean not null default false,
  sales_can_act_early boolean not null default false,
  sales_evidence text,
  recurring_evidence text,
  speed_evidence text,
  use_calculated_sales boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.project_sales_marketing enable row level security;
drop policy if exists "prototype project_sales_marketing access" on public.project_sales_marketing;
create policy "prototype project_sales_marketing access" on public.project_sales_marketing for all using (true) with check (true);


-- v7.0.2 cloud-first project persistence
-- Price / Lift is stored in project_sales_marketing.average_selling_price.
-- This table is required for cross-device project synchronization.
alter table public.project_sales_marketing add column if not exists average_selling_price numeric not null default 0;
