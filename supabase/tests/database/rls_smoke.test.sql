-- supabase test (pg_tap) — run with: supabase test db
-- Smoke test for cross-org isolation: a user in org A cannot read
-- materials belonging to org B via RLS.

begin;
select plan(2);

-- Setup: two orgs, one user in each
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
values
  ('cccccccc-0000-0000-0000-000000000001', 'a@test.local', '', now(), 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000002', 'b@test.local', '', now(), 'authenticated', 'authenticated');

insert into public.orgs (id, name, slug) values
  ('cccccccc-1111-0000-0000-000000000001', 'Org A', 'org-a-rls'),
  ('cccccccc-1111-0000-0000-000000000002', 'Org B', 'org-b-rls');

insert into public.org_members (org_id, user_id) values
  ('cccccccc-1111-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001'),
  ('cccccccc-1111-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002');

insert into public.seasons (id, org_id, name, slug) values
  ('cccccccc-2222-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000001', 'S', 's-a'),
  ('cccccccc-2222-0000-0000-000000000002', 'cccccccc-1111-0000-0000-000000000002', 'S', 's-b');

insert into public.shows (id, org_id, season_id, name, slug) values
  ('cccccccc-3333-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000001',
   'cccccccc-2222-0000-0000-000000000001', 'Show A', 'show-a'),
  ('cccccccc-3333-0000-0000-000000000002', 'cccccccc-1111-0000-0000-000000000002',
   'cccccccc-2222-0000-0000-000000000002', 'Show B', 'show-b');

insert into public.departments (id, show_id, name, slug) values
  ('cccccccc-4444-0000-0000-000000000001', 'cccccccc-3333-0000-0000-000000000001', 'D', 'd-a'),
  ('cccccccc-4444-0000-0000-000000000002', 'cccccccc-3333-0000-0000-000000000002', 'D', 'd-b');

insert into public.materials (id, department_id, uploaded_by, type, state, title) values
  ('cccccccc-5555-0000-0000-000000000001', 'cccccccc-4444-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'note', 'exploratory', 'Material in Org A'),
  ('cccccccc-5555-0000-0000-000000000002', 'cccccccc-4444-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000002', 'note', 'exploratory', 'Material in Org B');

-- As user A: should see exactly the org-A material
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.materials where title in ('Material in Org A', 'Material in Org B') $$,
  $$ values (1) $$,
  'user in org A sees only their own org materials'
);

-- As user B
set local "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select title from public.materials where title in ('Material in Org A', 'Material in Org B') $$,
  $$ values ('Material in Org B'::text) $$,
  'user in org B sees only their own org materials'
);

select * from finish();
rollback;
