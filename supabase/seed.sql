-- Orgs
insert into public.orgs (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'State University Theater', 'state-u-theater'),
  ('00000000-0000-0000-0000-000000000002', 'Riverside Regional Theater', 'riverside-regional');

-- Seasons
insert into public.seasons (id, org_id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2025–26 Season', '2025-26'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2024–25 Season', '2024-25'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '2025–26 Season', '2025-26');

-- Shows
insert into public.shows (id, org_id, season_id, name, slug, approval_mode, allow_reopen) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Hamlet', 'hamlet', 'multi', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'The Tempest', 'the-tempest', 'single', false),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'King Lear', 'king-lear', 'multi', false),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'A Streetcar Named Desire', 'streetcar', 'single', true);

-- Departments
insert into public.departments (id, show_id, name, slug) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Costume Design',  'costume-design'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Lighting Design', 'lighting-design'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Costume Design',  'costume-design'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'Costume Design',  'costume-design');

-- Role definitions (org-level defaults)
insert into public.role_definitions (id, org_id, show_id, name, permissions) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, 'Director', '{can_approve,can_manage_members,can_manage_show}'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null, 'Designer', '{can_upload}'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', null, 'Director', '{can_approve,can_manage_members,can_manage_show}'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', null, 'Designer', '{can_upload}');

-- Users (auth.users — 3 test accounts for State U Theater)
-- Passwords are all "password123" (bcrypt hash)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'director@test.local',
    '$2a$10$PgjyuBMxaQJHZhFHtcmQbe7jW5UlUvWj1C/UiLAqb0mxBJzqxjxjK',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated', 'authenticated'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'scenic@test.local',
    '$2a$10$PgjyuBMxaQJHZhFHtcmQbe7jW5UlUvWj1C/UiLAqb0mxBJzqxjxjK',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated', 'authenticated'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'costume@test.local',
    '$2a$10$PgjyuBMxaQJHZhFHtcmQbe7jW5UlUvWj1C/UiLAqb0mxBJzqxjxjK',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated', 'authenticated'
  );

-- Profiles
insert into public.profiles (id, display_name) values
  ('a0000000-0000-0000-0000-000000000001', 'Alex Rivera (Director)'),
  ('a0000000-0000-0000-0000-000000000002', 'Jordan Kim (Scenic Designer)'),
  ('a0000000-0000-0000-0000-000000000003', 'Casey Morgan (Costume Designer)');

-- Org members (all three in State U Theater)
insert into public.org_members (org_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003');

-- Materials (Hamlet — scenic and costume departments)
insert into public.materials (id, department_id, uploaded_by, type, state, title, description, tags) values
  -- Scenic Design materials
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'image', 'exploratory', 'Act I Castle Sketch', 'Initial rough sketch of Elsinore courtyard', '{sketch,act-1,exterior}'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'image', 'proposed', 'Throne Room Rendering', 'Final rendering of the throne room for approval', '{rendering,act-2,interior}'),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'file', 'decided', 'Scenic Plot v3', 'Approved ground plan and section', '{plot,approved}'),
  -- Costume Design materials
  ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'image', 'exploratory', 'Hamlet Costume Reference', 'Period reference images for Hamlet''s mourning clothes', '{reference,hamlet,mourning}'),
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'image', 'proposed', 'Ophelia Act IV Sketch', 'Sketch for Ophelia''s madness scene costume', '{sketch,ophelia,act-4}');

-- Notes (material-attached and show-attached; one hidden)
insert into public.notes (id, body, tags, created_by, updated_by, hidden_at, material_id, show_id) values
  -- Note on the castle sketch (exploratory)
  (
    'b0000000-0000-0000-0000-000000000001',
    'Love the scale here — feels oppressive in the right way. Can we push the ceiling height even further in the throne room version?',
    '{scale,atmosphere}',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    null,
    '50000000-0000-0000-0000-000000000001',
    null
  ),
  -- Note on the throne room rendering (proposed)
  (
    'b0000000-0000-0000-0000-000000000002',
    'The gold tones read as corrupt power — exactly right. Flagging for approval at Monday''s production meeting.',
    '{approval,production-meeting}',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    null,
    '50000000-0000-0000-0000-000000000002',
    null
  ),
  -- Note on the scenic plot — hidden (superseded by v3)
  (
    'b0000000-0000-0000-0000-000000000003',
    'v2 had a sightline issue in the balcony — column SR was blocking row J. This version is superseded by v3.',
    '{sightlines,superseded}',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    now() - interval '2 days',
    '50000000-0000-0000-0000-000000000003',
    null
  ),
  -- Note on Ophelia costume sketch
  (
    'b0000000-0000-0000-0000-000000000004',
    'The flowers in the hair are a strong image. Consider white fabric with water-stain distressing to suggest she''s already halfway gone.',
    '{texture,symbolism}',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000003',
    null,
    '50000000-0000-0000-0000-000000000005',
    null
  ),
  -- Show-level note on Hamlet
  (
    'b0000000-0000-0000-0000-000000000005',
    '## Production Meeting Notes — Week 3\n\nKey decisions:\n- Throne room approved pending lighting notes\n- Ophelia costume needs one more round\n- Scenic plot v3 is locked\n\nNext meeting: Monday 7pm',
    '{production-meeting,week-3}',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    null,
    null,
    '20000000-0000-0000-0000-000000000001'
  );
