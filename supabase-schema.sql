-- ============================================================
--  CJUREFX — SALES CRM  ·  Supabase schema (clean install)
--  Run ONCE on a brand-new Supabase project:  SQL Editor → paste → Run.
--  Full schema in one script (tables + RLS + constraints).
--  Closers are internal placeholders: closer1 / closer2.
-- ============================================================

-- 1) LEADS ----------------------------------------------------
create table if not exists public.ghl_leads (
  id             text primary key,           -- GHL contactId (or webinar-/manual- synthetic)
  name           text,
  email          text,
  phone          text,
  -- qualifier custom fields (from GHL custom fields)
  instagram      text,
  experience     text,
  pain_point     text,
  knowledge      text,
  time_frame     text,
  qualification  text,
  -- pipeline
  lead_type      text,
  tags           text[]      not null default '{}',
  status         text        not null default 'Novi',
  assigned_to    text,
  deal           text,
  notes          text,
  follow_up_date date,
  snoozed_until  timestamptz,
  -- AI
  ai_summary     text,
  ai_summary_at  timestamptz,
  -- first-touch attribution
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  -- timestamps
  date_added     timestamptz,
  synced_at      timestamptz,
  created_at     timestamptz not null default now(),
  constraint ghl_leads_assigned_chk
    check (assigned_to is null or assigned_to in ('closer1', 'closer2'))
);
create index if not exists idx_leads_status     on public.ghl_leads(status);
create index if not exists idx_leads_lead_type  on public.ghl_leads(lead_type);
create index if not exists idx_leads_assigned   on public.ghl_leads(assigned_to);
create index if not exists idx_leads_date_added on public.ghl_leads(date_added);
create index if not exists idx_leads_tags       on public.ghl_leads using gin(tags);

-- 2) DAILY ACTIVITY (manual setter stats) ---------------------
create table if not exists public.daily_entries (
  id         bigint generated always as identity primary key,
  member     text not null,
  year       int  not null,
  month      int  not null,                  -- 0-indexed (JS month)
  day        int  not null,
  calls      int  not null default 0,
  pickups    int  not null default 0,
  dq         int  not null default 0,
  followup   int  not null default 0,
  close      int  not null default 0,
  updated_at timestamptz not null default now(),
  constraint daily_entries_member_chk check (member in ('closer1', 'closer2')),
  constraint daily_entries_uq unique (member, year, month, day)
);

-- 3) ACTIVITY AUDIT LOG ---------------------------------------
create table if not exists public.lead_activities (
  id          bigint generated always as identity primary key,
  lead_id     text not null references public.ghl_leads(id) on delete cascade,
  actor_email text,
  action_type text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activities_lead on public.lead_activities(lead_id);
create index if not exists idx_activities_time on public.lead_activities(created_at desc);

-- 4) RLS — any signed-in (Google) user gets full access --------
alter table public.ghl_leads       enable row level security;
alter table public.daily_entries   enable row level security;
alter table public.lead_activities enable row level security;

create policy "auth full access - leads"
  on public.ghl_leads       for all to authenticated using (true) with check (true);
create policy "auth full access - daily"
  on public.daily_entries   for all to authenticated using (true) with check (true);
create policy "auth full access - activities"
  on public.lead_activities for all to authenticated using (true) with check (true);

-- 5) REALTIME — the SPA subscribes to postgres_changes on all three
--    tables (live pipeline, daily-stat sync, time-to-close feed).
--    REPLICA IDENTITY FULL so UPDATE/DELETE events carry the old row.
alter table public.ghl_leads       replica identity full;
alter table public.daily_entries   replica identity full;
alter table public.lead_activities replica identity full;

do $$
declare t text;
begin
  foreach t in array array['ghl_leads','daily_entries','lead_activities'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
