-- ATLAS v8.4.4: resource assignment roles and monthly assignment periods
alter table public.project_assignments add column if not exists assignment_role text;
alter table public.project_assignments add column if not exists start_month date;
alter table public.project_assignments add column if not exists finish_month date;

create or replace view public.project_portfolio_view as
select p.*, e.hours,e.loaded_rate,e.external_cost,e.capex,e.uncertainty,e.fte,e.allocation,e.gross_margin,e.annual_savings,e.year1_revenue,e.year2_revenue,e.year3_revenue,
s.project_type,s.cost_amount,s.quadrant_score,s.impact,s.lift,s.strategic,s.customer,s.speed,s.feasibility,s.confidence,s.technical_risk,s.production_risk,s.market_risk,
coalesce((select jsonb_agg(jsonb_build_object(
  'resourceId',a.resource_id,
  'hours',a.estimated_hours,
  'allocation',a.allocation,
  'role',a.assignment_role,
  'startMonth',a.start_month,
  'finishMonth',a.finish_month
)) from public.project_assignments a where a.project_id=p.id),'[]'::jsonb) assignments,
p.start_date as start_month
from public.projects p
left join public.project_estimates e on e.project_id=p.id
left join public.project_scores s on s.project_id=p.id;
