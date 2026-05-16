-- =============================================================================
-- AtomQuest Hackathon Goal Setting & Tracking Portal
-- Migration: 001_init.sql
-- Apply in Supabase Dashboard → SQL Editor, or via `supabase db push`
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enum Types
-- ---------------------------------------------------------------------------

create type role as enum ('employee', 'manager', 'admin');

create type cycle_phase as enum ('goal_setting', 'q1', 'q2', 'q3', 'q4_annual');

create type cycle_status as enum ('draft', 'active', 'closed');

create type uom_type as enum (
  'min_numeric',
  'max_numeric',
  'min_percent',
  'max_percent',
  'timeline',
  'zero'
);

create type goal_status as enum ('draft', 'submitted', 'approved', 'returned', 'locked');

create type quarter as enum ('q1', 'q2', 'q3', 'q4');

create type achievement_status as enum ('not_started', 'on_track', 'completed');

create type change_type as enum ('insert', 'update', 'delete');

create type escalation_rule_type as enum (
  'goal_not_submitted',
  'goal_not_approved',
  'checkin_not_done'
);

-- ---------------------------------------------------------------------------
-- Table: users
-- ---------------------------------------------------------------------------
-- Mirrors auth.users. Populated via trigger on auth.users INSERT.
-- id is the same UUID issued by Supabase Auth.

create table public.users (
  id            uuid primary key,  -- FK → auth.users(id), NOT enforced at DB level
                                    -- to avoid cross-schema FK complexity on Supabase
  email         text not null unique,
  full_name     text not null,
  role          role not null default 'employee',
  department    text,
  manager_id    uuid references public.users(id) on delete restrict,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_manager_id_idx on public.users(manager_id);

comment on table public.users is
  'Application user profiles. id matches auth.users.id.';
comment on column public.users.manager_id is
  'Self-referential FK to the direct (L1) manager.';

-- ---------------------------------------------------------------------------
-- Table: goal_cycles
-- ---------------------------------------------------------------------------

create table public.goal_cycles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  year          integer not null,
  phase         cycle_phase not null,
  window_open   date not null,
  window_close  date not null,
  status        cycle_status not null default 'draft',
  created_by    uuid not null references public.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint goal_cycles_window_check check (window_close >= window_open)
);

create index goal_cycles_year_phase_idx on public.goal_cycles(year, phase);
create index goal_cycles_status_idx on public.goal_cycles(status);

comment on table public.goal_cycles is
  'Administrative cycles (e.g. FY2025 Q1) that group goals.';

-- ---------------------------------------------------------------------------
-- Table: goals
-- ---------------------------------------------------------------------------

create table public.goals (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.users(id) on delete cascade,
  cycle_id            uuid not null references public.goal_cycles(id) on delete restrict,
  thrust_area         text not null,
  title               text not null,
  description         text,
  uom_type            uom_type not null,
  -- Stores: numeric string for numeric/percent types, ISO date for timeline, "N/A" for zero
  target              text not null,
  -- weightage must be 10-100; sum per (employee, cycle) = 100 enforced at app layer
  weightage           integer not null,
  status              goal_status not null default 'draft',
  is_shared           boolean not null default false,
  shared_from_goal_id uuid references public.goals(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint goals_weightage_range check (weightage >= 10 and weightage <= 100)
);

create index goals_employee_cycle_idx on public.goals(employee_id, cycle_id);
create index goals_cycle_id_idx on public.goals(cycle_id);
create index goals_status_idx on public.goals(status);
create index goals_shared_from_idx on public.goals(shared_from_goal_id)
  where shared_from_goal_id is not null;

comment on table public.goals is
  'Individual performance goals set by employees within a cycle.';
comment on column public.goals.target is
  'Stored as text to accommodate numeric, percent, ISO date (timeline), or N/A (zero uom_type).';
comment on column public.goals.shared_from_goal_id is
  'Non-null when this goal was pushed from an admin/manager shared template.';

-- ---------------------------------------------------------------------------
-- Table: quarterly_achievements
-- ---------------------------------------------------------------------------

create table public.quarterly_achievements (
  id                  uuid primary key default gen_random_uuid(),
  goal_id             uuid not null references public.goals(id) on delete cascade,
  quarter             quarter not null,
  actual_achievement  text not null,
  status              achievement_status not null default 'not_started',
  -- Computed by application: percentage of target reached, normalised 0-100
  computed_score      numeric(5, 2),
  submitted_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint quarterly_achievements_goal_quarter_unique unique (goal_id, quarter)
);

create index quarterly_achievements_goal_id_idx on public.quarterly_achievements(goal_id);

comment on table public.quarterly_achievements is
  'One row per (goal, quarter) recording actual achievement vs. target.';
comment on column public.quarterly_achievements.computed_score is
  'Application-computed score (0-100). Null until achievement is submitted.';

-- ---------------------------------------------------------------------------
-- Table: manager_checkins
-- ---------------------------------------------------------------------------

create table public.manager_checkins (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals(id) on delete cascade,
  manager_id  uuid not null references public.users(id) on delete restrict,
  quarter     quarter not null,
  comment     text not null,
  created_at  timestamptz not null default now()
);

create index manager_checkins_goal_id_idx   on public.manager_checkins(goal_id);
create index manager_checkins_manager_id_idx on public.manager_checkins(manager_id);
create index manager_checkins_quarter_idx   on public.manager_checkins(quarter);

comment on table public.manager_checkins is
  'Narrative check-in comments left by managers on a goal per quarter.';

-- ---------------------------------------------------------------------------
-- Table: audit_log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   text not null,   -- string so it can hold UUIDs or composite keys
  changed_by  uuid not null references public.users(id) on delete restrict,
  change_type change_type not null,
  old_value   jsonb,
  new_value   jsonb,
  changed_at  timestamptz not null default now()
);

create index audit_log_table_record_idx on public.audit_log(table_name, record_id);
create index audit_log_changed_by_idx   on public.audit_log(changed_by);
create index audit_log_changed_at_idx   on public.audit_log(changed_at desc);

comment on table public.audit_log is
  'Append-only log of mutations to key tables. Written by application layer.';

-- ---------------------------------------------------------------------------
-- Table: escalation_rules
-- ---------------------------------------------------------------------------

create table public.escalation_rules (
  id                  uuid primary key default gen_random_uuid(),
  rule_type           escalation_rule_type not null,
  trigger_days        integer not null,
  -- e.g. [{"role":"manager","delay_hours":0},{"role":"admin","delay_hours":24}]
  notification_chain  jsonb not null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint escalation_rules_trigger_days_positive check (trigger_days > 0)
);

comment on table public.escalation_rules is
  'Configurable rules that drive automated escalation notifications.';
comment on column public.escalation_rules.notification_chain is
  'Ordered array: [{role, delay_hours, additional_user_ids?}]. Processed by worker.';

-- ---------------------------------------------------------------------------
-- Helper function: resolve role for the calling auth.uid()
-- Used inside RLS policies to avoid repeated sub-selects.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Helper function: resolve manager_id for the calling auth.uid()
-- ---------------------------------------------------------------------------

create or replace function public.current_user_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select manager_id from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Helper function: is target user a direct report of the calling user?
-- manager_id column on users points to the user's OWN manager,
-- so "direct reports of me" = users where manager_id = auth.uid()
-- ---------------------------------------------------------------------------

create or replace function public.is_my_direct_report(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = target_user_id
      and manager_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger: auto-sync auth.users → public.users on sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'employee'  -- default; admin promotes via UPDATE
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger goal_cycles_updated_at
  before update on public.goal_cycles
  for each row execute function public.set_updated_at();

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create trigger quarterly_achievements_updated_at
  before update on public.quarterly_achievements
  for each row execute function public.set_updated_at();

create trigger escalation_rules_updated_at
  before update on public.escalation_rules
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security (RLS)
-- =============================================================================
-- Design:
--   employee  → sees own rows only
--   manager   → sees own rows + direct reports' rows
--   admin     → sees everything
--
-- Service-role key (used by route handlers) bypasses RLS entirely.
-- The patterns below apply only to anon/authenticated Supabase clients.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RLS: users
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

-- Everyone can read their own profile
create policy "users_select_own"
  on public.users for select
  using (id = auth.uid());

-- Managers can read their direct reports
create policy "users_select_manager_sees_reports"
  on public.users for select
  using (
    public.current_user_role() in ('manager', 'admin')
    and (
      manager_id = auth.uid()          -- direct reports of this manager
      or id = auth.uid()               -- self
    )
  );

-- Admins can read all users
create policy "users_select_admin"
  on public.users for select
  using (public.current_user_role() = 'admin');

-- Only admins can insert new user rows directly (trigger covers auth sign-up)
create policy "users_insert_admin"
  on public.users for insert
  with check (public.current_user_role() = 'admin');

-- Users can update their own non-sensitive fields; admins can update any
create policy "users_update_own_or_admin"
  on public.users for update
  using (
    id = auth.uid()
    or public.current_user_role() = 'admin'
  )
  with check (
    id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- Only admins can delete (soft-delete via is_active preferred)
create policy "users_delete_admin"
  on public.users for delete
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: goal_cycles
-- ---------------------------------------------------------------------------

alter table public.goal_cycles enable row level security;

-- All authenticated users can read cycles (needed to set/view goals)
create policy "goal_cycles_select_all_authenticated"
  on public.goal_cycles for select
  using (auth.uid() is not null);

-- Only admins can create/modify/delete cycles
create policy "goal_cycles_insert_admin"
  on public.goal_cycles for insert
  with check (public.current_user_role() = 'admin');

create policy "goal_cycles_update_admin"
  on public.goal_cycles for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "goal_cycles_delete_admin"
  on public.goal_cycles for delete
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: goals
-- ---------------------------------------------------------------------------

alter table public.goals enable row level security;

-- Employees see only their own goals
create policy "goals_select_employee_own"
  on public.goals for select
  using (employee_id = auth.uid());

-- Managers see their own goals plus goals of all direct reports
create policy "goals_select_manager_sees_reports"
  on public.goals for select
  using (
    public.current_user_role() in ('manager', 'admin')
    and (
      employee_id = auth.uid()
      or public.is_my_direct_report(employee_id)
    )
  );

-- Admins see all goals
create policy "goals_select_admin"
  on public.goals for select
  using (public.current_user_role() = 'admin');

-- Employees can create their own goals (when cycle window is open — enforced at app layer)
create policy "goals_insert_employee"
  on public.goals for insert
  with check (
    employee_id = auth.uid()
    or public.current_user_role() in ('manager', 'admin')  -- managers/admin can push shared goals
  );

-- Employees can update their own goals when status is draft/returned
-- Managers/admins can update any goal they can see (for approval/return actions)
create policy "goals_update_employee_own_draft"
  on public.goals for update
  using (
    (employee_id = auth.uid() and status in ('draft', 'returned'))
    or (
      public.current_user_role() in ('manager', 'admin')
      and (
        employee_id = auth.uid()
        or public.is_my_direct_report(employee_id)
        or public.current_user_role() = 'admin'
      )
    )
  )
  with check (
    (employee_id = auth.uid() and status in ('draft', 'returned'))
    or public.current_user_role() in ('manager', 'admin')
  );

-- Employees can delete own draft goals; admins can delete any
create policy "goals_delete_own_draft_or_admin"
  on public.goals for delete
  using (
    (employee_id = auth.uid() and status = 'draft')
    or public.current_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- RLS: quarterly_achievements
-- ---------------------------------------------------------------------------

alter table public.quarterly_achievements enable row level security;

-- Select: same visibility as goals (join via goal_id → employee_id)
create policy "quarterly_achievements_select"
  on public.quarterly_achievements for select
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id
        and (
          g.employee_id = auth.uid()
          or (
            public.current_user_role() in ('manager', 'admin')
            and (
              g.employee_id = auth.uid()
              or public.is_my_direct_report(g.employee_id)
              or public.current_user_role() = 'admin'
            )
          )
        )
    )
  );

-- Employees can insert/update achievements for their own goals
create policy "quarterly_achievements_insert"
  on public.quarterly_achievements for insert
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.employee_id = auth.uid()
    )
    or public.current_user_role() in ('manager', 'admin')
  );

create policy "quarterly_achievements_update"
  on public.quarterly_achievements for update
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.employee_id = auth.uid()
    )
    or public.current_user_role() in ('manager', 'admin')
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.employee_id = auth.uid()
    )
    or public.current_user_role() in ('manager', 'admin')
  );

-- ---------------------------------------------------------------------------
-- RLS: manager_checkins
-- ---------------------------------------------------------------------------

alter table public.manager_checkins enable row level security;

-- Select: goal owner sees checkins on their goals; manager sees their own checkins and their reports'; admin sees all
create policy "manager_checkins_select"
  on public.manager_checkins for select
  using (
    manager_id = auth.uid()
    or exists (
      select 1 from public.goals g
      where g.id = goal_id
        and (
          g.employee_id = auth.uid()
          or (
            public.current_user_role() in ('manager', 'admin')
            and (
              public.is_my_direct_report(g.employee_id)
              or public.current_user_role() = 'admin'
            )
          )
        )
    )
  );

-- Only managers and admins can insert check-ins
create policy "manager_checkins_insert"
  on public.manager_checkins for insert
  with check (
    manager_id = auth.uid()
    and public.current_user_role() in ('manager', 'admin')
  );

-- Managers can update their own check-ins; admins can update any
create policy "manager_checkins_update"
  on public.manager_checkins for update
  using (
    manager_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
  with check (
    manager_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- RLS: audit_log
-- ---------------------------------------------------------------------------

alter table public.audit_log enable row level security;

-- Only admins can read the audit log via direct Supabase client
-- Route handlers use service-role key and bypass RLS
create policy "audit_log_select_admin"
  on public.audit_log for select
  using (public.current_user_role() = 'admin');

-- Inserts are done by the application via service-role key (no client-side inserts)
-- Still define a policy so authenticated clients cannot forge audit entries
create policy "audit_log_insert_deny_non_service"
  on public.audit_log for insert
  with check (false);  -- All inserts must go through service-role

-- ---------------------------------------------------------------------------
-- RLS: escalation_rules
-- ---------------------------------------------------------------------------

alter table public.escalation_rules enable row level security;

-- Only admins can read/write escalation rules
create policy "escalation_rules_select_admin"
  on public.escalation_rules for select
  using (public.current_user_role() = 'admin');

create policy "escalation_rules_insert_admin"
  on public.escalation_rules for insert
  with check (public.current_user_role() = 'admin');

create policy "escalation_rules_update_admin"
  on public.escalation_rules for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "escalation_rules_delete_admin"
  on public.escalation_rules for delete
  using (public.current_user_role() = 'admin');

-- =============================================================================
-- Grants
-- =============================================================================
-- Supabase automatically grants anon/authenticated roles SELECT on public tables
-- only if RLS is satisfied. Explicit grants below cover UPDATE/INSERT/DELETE.

grant usage on schema public to anon, authenticated;

grant select on public.users              to anon, authenticated;
grant select on public.goal_cycles        to anon, authenticated;
grant select, insert, update, delete on public.goals                   to authenticated;
grant select, insert, update            on public.quarterly_achievements to authenticated;
grant select, insert, update            on public.manager_checkins      to authenticated;
grant select                            on public.audit_log              to authenticated;
grant select                            on public.escalation_rules       to authenticated;

-- users: allow authenticated to update their own profile fields
grant update (full_name, department) on public.users to authenticated;
-- admins need broader update; handled via service-role in route handlers

-- =============================================================================
-- Seed: default escalation rules
-- =============================================================================

insert into public.escalation_rules (rule_type, trigger_days, notification_chain, is_active)
values
  (
    'goal_not_submitted',
    3,
    '[{"role":"manager","delay_hours":0},{"role":"admin","delay_hours":48}]',
    true
  ),
  (
    'goal_not_approved',
    5,
    '[{"role":"manager","delay_hours":0},{"role":"admin","delay_hours":72}]',
    true
  ),
  (
    'checkin_not_done',
    7,
    '[{"role":"manager","delay_hours":0},{"role":"admin","delay_hours":48}]',
    true
  );
