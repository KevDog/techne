-- Extend orgs with settings
alter table public.orgs
  add column settings jsonb not null default '{"claude_enabled": false}';

-- Profiles: public mirror of auth.users for display names
-- Standard Supabase pattern — accessible via PostgREST with RLS
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view all profiles"
  on public.profiles for select
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Auto-create profile on sign-up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seasons
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique(org_id, slug)
);

alter table public.seasons enable row level security;

create policy "org members can view seasons"
  on public.seasons for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = seasons.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Shows
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  name text not null,
  slug text not null,
  approval_mode text not null default 'single' check (approval_mode in ('single', 'multi')),
  allow_reopen boolean not null default false,
  created_at timestamptz not null default now(),
  unique(org_id, slug)
);

alter table public.shows enable row level security;

create policy "org members can view shows"
  on public.shows for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = shows.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Departments
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;

create policy "org members can view departments"
  on public.departments for select
  using (
    exists (
      select 1 from public.shows
      join public.org_members on org_members.org_id = shows.org_id
      where shows.id = departments.show_id
        and org_members.user_id = auth.uid()
    )
  );

-- Role definitions
create table public.role_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid references public.shows(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.role_definitions enable row level security;

create policy "org members can view role definitions"
  on public.role_definitions for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = role_definitions.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Show members
create table public.show_members (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_definition_id uuid not null references public.role_definitions(id),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique(show_id, user_id)
);

-- At most one featured member per show
create unique index show_members_one_featured_per_show
  on public.show_members (show_id) where (featured = true);

alter table public.show_members enable row level security;

create policy "org members can view show members"
  on public.show_members for select
  using (
    exists (
      select 1 from public.shows
      join public.org_members on org_members.org_id = shows.org_id
      where shows.id = show_members.show_id
        and org_members.user_id = auth.uid()
    )
  );
