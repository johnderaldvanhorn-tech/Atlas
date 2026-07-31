-- Project Portfolio Planner v7.1.4
-- Make source_line the unique identifier for Development items.
-- This migration keeps the most recently updated row for each source_line
-- and removes older duplicate rows before creating the unique index.

begin;

with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by source_line
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as duplicate_rank
  from public.development_items
  where source_line is not null
)
delete from public.development_items d
using ranked_duplicates r
where d.id = r.id
  and r.duplicate_rank > 1;

drop index if exists public.development_items_source_line_uidx;
create unique index development_items_source_line_uidx
  on public.development_items (source_line)
  where source_line is not null;

commit;

-- Verification: this should return zero rows.
select source_line, count(*) as row_count
from public.development_items
where source_line is not null
group by source_line
having count(*) > 1
order by source_line;
