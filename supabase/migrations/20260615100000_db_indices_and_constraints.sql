-- 1. Composite index on materials (department_id, state) for the
--    common "filter materials in a dept by state" query.
create index if not exists materials_dept_state_idx
  on public.materials (department_id, state);

-- 2. Notes RLS performance: meeting-attached note lookups in the
--    update/select policies join on (meeting_id, created_by).
create index if not exists notes_meeting_creator_idx
  on public.notes (meeting_id, created_by)
  where meeting_id is not null;

-- 3. orgs.settings: normalize the key to match application code
--    (claude_enabled → claudeEnabled), then enforce shape via CHECK.
--    The original column was added with default '{"claude_enabled": false}'
--    but the app reads settings.claudeEnabled, so the flag was dead.

update public.orgs
   set settings = jsonb_set(
     settings - 'claude_enabled',
     '{claudeEnabled}',
     coalesce(settings -> 'claude_enabled', 'false'::jsonb),
     true
   )
 where settings ? 'claude_enabled';

-- Set a new default that matches the app
alter table public.orgs
  alter column settings set default '{"claudeEnabled": false}'::jsonb;

-- Backfill any rows still missing the key
update public.orgs
   set settings = settings || '{"claudeEnabled": false}'::jsonb
 where not (settings ? 'claudeEnabled');

-- Enforce shape: claudeEnabled must be a boolean
alter table public.orgs
  add constraint orgs_settings_claude_enabled_bool
  check (jsonb_typeof(settings -> 'claudeEnabled') = 'boolean');
