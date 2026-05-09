-- Security fixes for Plan 3 materials RLS policies

-- ── Fix 1: materials UPDATE — prevent uploaded_by mutation ────────────────────
-- The original WITH CHECK only enforced org membership, allowing any org member
-- to rewrite uploaded_by to another user's ID (delete-by-impersonation attack).

drop policy "org members can update materials" on public.materials;

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
  )
  with check (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
    -- prevent uploaded_by from being changed after insert
    and uploaded_by = (select uploaded_by from public.materials where id = materials.id)
  );

-- ── Fix 2: storage DELETE — restrict to uploader only ────────────────────────
-- Path pattern: {org_id}/{show_id}/{dept_id}/{material_id}/{filename}
-- segment 4 = material_id; join to materials to verify ownership.

drop policy "org members can delete material files" on storage.objects;

create policy "uploaders can delete material files"
  on storage.objects for delete
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.materials
      where id = split_part(name, '/', 4)::uuid
        and uploaded_by = auth.uid()
    )
  );
