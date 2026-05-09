-- Organizations table
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Org membership
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);

-- Enable RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

-- RLS: users can only see orgs they belong to
create policy "members can view their orgs"
  on public.orgs for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = orgs.id
        and org_members.user_id = auth.uid()
    )
  );

-- RLS: users can see their own memberships
create policy "users can view own memberships"
  on public.org_members for select
  using (user_id = auth.uid());
