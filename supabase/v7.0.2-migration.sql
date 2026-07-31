-- Project Portfolio Planner v7.0.2
-- Run this in Supabase SQL Editor before deploying v7.0.2.

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

alter table public.project_sales_marketing
  add column if not exists average_selling_price numeric not null default 0;

alter table public.project_sales_marketing enable row level security;

drop policy if exists "prototype project_sales_marketing access" on public.project_sales_marketing;
create policy "prototype project_sales_marketing access"
  on public.project_sales_marketing
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Carry forward any value previously stored in projects.price_lift when that
-- legacy column exists. This block safely does nothing when it does not exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='projects' and column_name='price_lift'
  ) then
    execute $sql$
      insert into public.project_sales_marketing (project_id, average_selling_price)
      select id, coalesce(price_lift,0) from public.projects
      on conflict (project_id) do update
      set average_selling_price = excluded.average_selling_price,
          updated_at = now()
    $sql$;
  end if;
end $$;
