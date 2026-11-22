-- CONSTRUCTA — initial schema
-- Run in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'worker');
create type public.location_kind as enum ('building', 'floor', 'unit', 'room', 'area');
create type public.task_status as enum ('open', 'done');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  role        public.user_role not null default 'worker',
  language    text not null default 'he' check (language in ('he', 'ar', 'th')),
  created_at  timestamptz not null default now()
);
create unique index profiles_email_idx on public.profiles (lower(email));

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  address     text,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  radius_m    integer not null default 150 check (radius_m between 20 and 5000),
  created_at  timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Building -> floor -> unit -> room (any depth)
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  parent_id   uuid references public.locations (id) on delete cascade,
  kind        public.location_kind not null,
  name        text not null,
  sort        integer not null default 0
);

-- Assignment: assignee_id -> one worker, team_id -> a team, both null -> everyone on the project.
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  location_id   uuid references public.locations (id) on delete set null,
  title         text not null,
  instructions  text,
  video_url     text,
  assignee_id   uuid references public.profiles (id) on delete set null,
  team_id       uuid references public.teams (id) on delete set null,
  due_date      date not null default current_date,
  status        public.task_status not null default 'open',
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null,
  photo_path    text,
  created_at    timestamptz not null default now(),
  constraint done_needs_photo check (status = 'open' or photo_path is not null)
);
create index tasks_project_due_idx on public.tasks (project_id, due_date);

create table public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  project_id           uuid not null references public.projects (id) on delete cascade,
  check_in_at          timestamptz not null default now(),
  check_in_lat         double precision,
  check_in_lng         double precision,
  check_in_distance_m  integer,
  check_out_at         timestamptz,
  edited_by            uuid references public.profiles (id) on delete set null,
  edit_note            text,
  edited_at            timestamptz,
  constraint out_after_in check (check_out_at is null or check_out_at >= check_in_at)
);
-- A worker can have only one open shift at a time.
create unique index attendance_one_open_shift on public.attendance (user_id) where check_out_at is null;
create index attendance_project_in_idx on public.attendance (project_id, check_in_at);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function public.is_project_owner(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p and owner_id = auth.uid());
$$;

create or replace function public.is_project_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid());
$$;

create or replace function public.my_team(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from project_members where project_id = p and user_id = auth.uid();
$$;

-- Is the current user allowed to see this task as a worker?
create or replace function public.task_visible_to_me(t public.tasks) returns boolean
language sql stable security definer set search_path = public as $$
  select is_project_member(t.project_id)
     and (
       t.assignee_id = auth.uid()
       or (t.team_id is not null and t.team_id = my_team(t.project_id))
       or (t.assignee_id is null and t.team_id is null)
     );
$$;

create or replace function public.haversine_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------------
-- New user -> profile (role/name/language come from sign-up metadata)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role, language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'manager' then 'manager'::user_role else 'worker'::user_role end,
    case when new.raw_user_meta_data ->> 'language' in ('he', 'ar', 'th')
         then new.raw_user_meta_data ->> 'language' else 'he' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.teams           enable row level security;
alter table public.project_members enable row level security;
alter table public.locations       enable row level security;
alter table public.tasks           enable row level security;
alter table public.attendance      enable row level security;

-- profiles: see yourself; managers see members of their projects.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from project_members pm join projects p on p.id = pm.project_id
    where pm.user_id = profiles.id and p.owner_id = auth.uid()
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may change only their name and language, never their role.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, language) on public.profiles to authenticated;

-- projects
create policy projects_select on public.projects for select to authenticated
  using (owner_id = auth.uid() or is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid() and is_manager());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = auth.uid());

-- teams
create policy teams_select on public.teams for select to authenticated
  using (is_project_owner(project_id) or is_project_member(project_id));
create policy teams_write on public.teams for all to authenticated
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));

-- project_members
create policy members_select on public.project_members for select to authenticated
  using (user_id = auth.uid() or is_project_owner(project_id));
create policy members_write on public.project_members for all to authenticated
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));

-- locations
create policy locations_select on public.locations for select to authenticated
  using (is_project_owner(project_id) or is_project_member(project_id));
create policy locations_write on public.locations for all to authenticated
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));

-- tasks: workers see only their own / their team's / project-wide tasks.
create policy tasks_select on public.tasks for select to authenticated
  using (is_project_owner(project_id) or task_visible_to_me(tasks));
create policy tasks_write on public.tasks for all to authenticated
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));

-- attendance: workers read their own (writes go through RPCs); managers read/edit for their projects.
create policy attendance_select on public.attendance for select to authenticated
  using (user_id = auth.uid() or is_project_owner(project_id));
create policy attendance_owner_insert on public.attendance for insert to authenticated
  with check (is_project_owner(project_id));
create policy attendance_owner_update on public.attendance for update to authenticated
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));
create policy attendance_owner_delete on public.attendance for delete to authenticated
  using (is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- RPCs used by the app
-- ---------------------------------------------------------------------------

-- Check in only when within the project's radius (distance is computed on the server).
create or replace function public.check_in(p_project uuid, p_lat double precision, p_lng double precision)
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_proj projects;
  v_dist double precision;
  v_row  attendance;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not is_project_member(p_project) then raise exception 'not_member'; end if;
  if exists (select 1 from attendance where user_id = auth.uid() and check_out_at is null) then
    raise exception 'already_checked_in';
  end if;

  select * into v_proj from projects where id = p_project;
  v_dist := haversine_m(p_lat, p_lng, v_proj.lat, v_proj.lng);
  if v_dist > v_proj.radius_m then
    raise exception 'outside_radius:%', round(v_dist)::int;
  end if;

  insert into attendance (user_id, project_id, check_in_lat, check_in_lng, check_in_distance_m)
  values (auth.uid(), p_project, p_lat, p_lng, round(v_dist)::int)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.check_out()
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare v_row attendance;
begin
  update attendance set check_out_at = now()
  where user_id = auth.uid() and check_out_at is null
  returning * into v_row;
  if v_row.id is null then raise exception 'not_checked_in'; end if;
  return v_row;
end;
$$;

-- Close a task immediately (no manager approval). A photo is mandatory.
create or replace function public.complete_task(p_task uuid, p_photo_path text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare v_task tasks;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null or not task_visible_to_me(v_task) then raise exception 'task_not_found'; end if;
  if v_task.status = 'done' then return v_task; end if;
  if coalesce(p_photo_path, '') = '' or p_photo_path not like v_task.project_id::text || '/%' then
    raise exception 'photo_required';
  end if;

  update tasks
     set status = 'done', completed_at = now(), completed_by = auth.uid(), photo_path = p_photo_path
   where id = p_task
  returning * into v_task;
  return v_task;
end;
$$;

-- Manager adds a registered worker to a project by email.
create or replace function public.add_member_by_email(p_project uuid, p_email text, p_team uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not is_project_owner(p_project) then raise exception 'not_owner'; end if;
  select id into v_user from profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'worker_not_found'; end if;
  if p_team is not null and not exists (select 1 from teams where id = p_team and project_id = p_project) then
    raise exception 'bad_team';
  end if;
  insert into project_members (project_id, user_id, team_id) values (p_project, v_user, p_team)
  on conflict (project_id, user_id) do update set team_id = excluded.team_id;
end;
$$;

revoke execute on function public.check_in(uuid, double precision, double precision) from anon;
revoke execute on function public.check_out() from anon;
revoke execute on function public.complete_task(uuid, text) from anon;
revoke execute on function public.add_member_by_email(uuid, text, uuid) from anon;

-- ---------------------------------------------------------------------------
-- Progress per location, rolled up the tree (respects RLS of the caller)
-- ---------------------------------------------------------------------------
create or replace view public.location_progress with (security_invoker = true) as
with recursive tree as (
  select id as root_id, id from public.locations
  union all
  select t.root_id, l.id from public.locations l join tree t on l.parent_id = t.id
)
select l.id, l.project_id, l.parent_id, l.kind, l.name, l.sort,
       count(tk.id)::int                                   as total,
       count(tk.id) filter (where tk.status = 'done')::int as done
from public.locations l
join tree on tree.root_id = l.id
left join public.tasks tk on tk.location_id = tree.id
group by l.id;

-- ---------------------------------------------------------------------------
-- Realtime (manager dashboard refreshes live)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.attendance, public.tasks;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for task photos, path = <project_id>/<task_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.photo_project(object_name text) returns uuid
language plpgsql immutable as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy task_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and public.is_project_member(public.photo_project(name)));
create policy task_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and (
    public.is_project_member(public.photo_project(name)) or public.is_project_owner(public.photo_project(name))
  ));
