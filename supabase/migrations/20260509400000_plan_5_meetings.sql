-- supabase/migrations/20260509400000_plan_5_meetings.sql

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references public.shows(id) on delete cascade,
  title         text not null,
  scheduled_at  timestamptz not null,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_by    uuid not null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now()
);

create index meetings_show_id_idx    on public.meetings(show_id);
create index meetings_created_by_idx on public.meetings(created_by);

alter table public.meetings enable row level security;

create policy "show members can select meetings"
  on public.meetings for select
  using (
    exists (
      select 1 from public.show_members sm
      where sm.show_id = meetings.show_id and sm.user_id = auth.uid()
    )
  );

create policy "show members can insert meetings"
  on public.meetings for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.show_members sm
      where sm.show_id = meetings.show_id and sm.user_id = auth.uid()
    )
  );

create policy "show members can update meetings"
  on public.meetings for update
  using (
    exists (
      select 1 from public.show_members sm
      where sm.show_id = meetings.show_id and sm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.show_members sm
      where sm.show_id = meetings.show_id and sm.user_id = auth.uid()
    )
  );

-- Add FK from notes.meeting_id now that meetings table exists
alter table public.notes
  add constraint notes_meeting_id_fkey
  foreign key (meeting_id) references public.meetings(id) on delete cascade;

-- Update notes RLS to cover meeting-attached notes (drop + recreate all three)
drop policy "org members can select notes" on public.notes;
drop policy "org members can insert notes" on public.notes;
drop policy "org members can update notes" on public.notes;

create policy "org members can select notes"
  on public.notes for select
  using (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
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
        where mat.id = notes.material_id and om.user_id = auth.uid()
      ))
      or (show_id is not null and exists (
        select 1 from public.shows s
        join public.org_members om on om.org_id = s.org_id
        where s.id = notes.show_id and om.user_id = auth.uid()
      ))
      or (meeting_id is not null and exists (
        select 1 from public.meetings m
        join public.shows s on s.id = m.show_id
        join public.org_members om on om.org_id = s.org_id
        where m.id = notes.meeting_id and om.user_id = auth.uid()
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
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
    ))
  )
  with check (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
    ))
  );
