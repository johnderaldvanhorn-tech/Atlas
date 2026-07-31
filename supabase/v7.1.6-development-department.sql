-- v7.1.6: add Cloud/Edge department and use (source_line, department) as identity.
begin;

alter table public.development_items
  add column if not exists department text;

-- Existing records predate the department field and are treated as Cloud.
update public.development_items
set department = 'Cloud'
where department is null or btrim(department) = '';

alter table public.development_items
  alter column department set default 'Cloud';

alter table public.development_items
  alter column department set not null;

alter table public.development_items
  drop constraint if exists development_items_department_check;

alter table public.development_items
  add constraint development_items_department_check
  check (department in ('Cloud', 'Edge'));

-- Keep the most recently updated row for each Source Line + Department pair.
with ranked as (
  select id,
         row_number() over (
           partition by source_line, department
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as rn
  from public.development_items
  where source_line is not null
)
delete from public.development_items d
using ranked r
where d.id = r.id and r.rn > 1;

-- Remove the old source-only uniqueness and replace it with the composite key.
alter table public.development_items
  drop constraint if exists development_items_source_line_key;

drop index if exists public.development_items_source_line_uidx;
drop index if exists public.development_items_source_department_uidx;

alter table public.development_items
  add constraint development_items_source_department_key
  unique (source_line, department);

create index if not exists development_items_department_idx
  on public.development_items (department);

commit;

-- Verification: should return no rows.
select source_line, department, count(*) as row_count
from public.development_items
where source_line is not null
group by source_line, department
having count(*) > 1
order by source_line, department;
