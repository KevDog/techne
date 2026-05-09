-- ── notes ─────────────────────────────────────────────────────────────────────

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  body         text not null,
  tags         text[] not null default '{}',
  created_by   uuid not null references public.profiles(id) on delete restrict,
  updated_by   uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  hidden_at    timestamptz,
  material_id  uuid references public.materials(id) on delete cascade,
  show_id      uuid references public.shows(id) on delete cascade,
  -- meeting_id has no FK yet — meetings table is created in Plan 5
  meeting_id   uuid,
  constraint notes_exactly_one_attachment
    check (num_nonnulls(material_id, show_id, meeting_id) = 1)
);

create index notes_material_id_idx  on public.notes(material_id);
create index notes_show_id_idx      on public.notes(show_id);
create index notes_meeting_id_idx   on public.notes(meeting_id);
create index notes_created_by_idx   on public.notes(created_by);

alter table public.notes enable row level security;

create policy "org members can select notes"
  on public.notes for select
  using (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id
        and om.user_id = auth.uid()
    ))
    or
    (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id
        and om.user_id = auth.uid()
    ))
  );

create policy "org members can insert notes"
  on public.notes for insert
  with check (
    created_by = auth.uid()
    and (
      (material_id is not null and exists (
        select 1 from public.materials mat
        join public.departments d on d.id = mat.department_id
        join public.shows s on s.id = d.show_id
        join public.org_members om on om.org_id = s.org_id
        where mat.id = notes.material_id
          and om.user_id = auth.uid()
      ))
      or
      (show_id is not null and exists (
        select 1 from public.shows s
        join public.org_members om on om.org_id = s.org_id
        where s.id = notes.show_id
          and om.user_id = auth.uid()
      ))
    )
  );

create policy "org members can update notes"
  on public.notes for update
  using (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id
        and om.user_id = auth.uid()
    ))
    or
    (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id
        and om.user_id = auth.uid()
    ))
  )
  with check (
    updated_by = auth.uid()
    and (
      (material_id is not null and exists (
        select 1 from public.materials mat
        join public.departments d on d.id = mat.department_id
        join public.shows s on s.id = d.show_id
        join public.org_members om on om.org_id = s.org_id
        where mat.id = notes.material_id
          and om.user_id = auth.uid()
      ))
      or
      (show_id is not null and exists (
        select 1 from public.shows s
        join public.org_members om on om.org_id = s.org_id
        where s.id = notes.show_id
          and om.user_id = auth.uid()
      ))
    )
  );
