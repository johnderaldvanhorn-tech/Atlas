-- Engineering Portfolio Manager v8.1.0 Phase 2
-- Link Development Support items to Product Initiatives.

begin;

alter table public.development_items
  add column if not exists project_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'development_items_project_id_fkey'
      and conrelid = 'public.development_items'::regclass
  ) then
    alter table public.development_items
      add constraint development_items_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete set null;
  end if;
end $$;

create index if not exists development_items_project_id_idx
  on public.development_items(project_id);

commit;
