-- supabase/migrations/20260509100000_plan_3_materials.sql

-- ── departments.slug ──────────────────────────────────────────────────────────

alter table public.departments
  add column slug text;

update public.departments
  set slug = lower(trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));

alter table public.departments
  alter column slug set not null;

alter table public.departments
  add constraint departments_show_id_slug_key unique (show_id, slug);

-- ── materials ─────────────────────────────────────────────────────────────────

create table public.materials (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete cascade,
  uploaded_by    uuid not null references public.profiles(id) on delete restrict,
  type           text not null check (type in ('image', 'file', 'link', 'note')),
  state          text not null default 'exploratory' check (state in ('exploratory', 'proposed', 'decided')),
  title          text not null,
  description    text,
  url            text,
  storage_path   text,
  body           text,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create index materials_department_id_idx on public.materials(department_id);
create index materials_uploaded_by_idx   on public.materials(uploaded_by);
create index materials_state_idx         on public.materials(state);

alter table public.materials enable row level security;

create policy "org members can select materials"
  on public.materials for select
  using (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "org members can insert materials"
  on public.materials for insert
  with check (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "org members can update materials"
  on public.materials for update
  using (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "uploaders can delete materials"
  on public.materials for delete
  using (uploaded_by = auth.uid());

-- ── storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('materials', 'materials', false)
  on conflict (id) do nothing;

create policy "org members can upload material files"
  on storage.objects for insert
  with check (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );

create policy "org members can read material files"
  on storage.objects for select
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );

create policy "org members can delete material files"
  on storage.objects for delete
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );
