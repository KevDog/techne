-- Fix meetings UPDATE policy: restrict WITH CHECK to creator only
drop policy "org members can update meetings" on public.meetings;

create policy "org members can update meetings"
  on public.meetings for update
  using (
    exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  );
