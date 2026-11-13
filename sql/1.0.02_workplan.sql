-- Version 1.0.02 (Küche): Arbeitsplan nach Kalenderwochen (KW) mit Veröffentlichung
-- Im Supabase SQL Editor ausführen (nach 1.0.01_recipes.sql).
-- work_schedules: eine Zeile pro Person und Tag (so arbeiten auch „Mein Arbeitsplan“, Tausch und Lohn weiter).
-- plan_weeks: pro Woche (Montag) „Entwurf“ oder „veröffentlicht“.
-- Mitarbeiter sehen nur VERÖFFENTLICHTE Wochen. Manager/Developer sehen und bearbeiten alles (auch Wochen im Voraus).

create table if not exists public.work_schedules (
  id            bigserial primary key,
  employee_name text not null,
  station       text,                     -- z. B. GM, Entre, Sc, EXP
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  day           int  not null check (day between 1 and 31),
  shift_1_start text,                     -- "HH:MM" oder Code: OFF, X, U, K, ZA, F
  shift_1_end   text,
  shift_2_start text,
  shift_2_end   text,
  work_date     date generated always as (make_date(year, month, day)) stored,
  week_start    date generated always as (make_date(year, month, day) - (extract(isodow from make_date(year, month, day))::int - 1)) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (employee_name, year, month, day)
);
create index if not exists work_schedules_week_idx on public.work_schedules (week_start);
create index if not exists work_schedules_ym_idx on public.work_schedules (year, month);

create table if not exists public.plan_weeks (
  week_start   date primary key,          -- immer ein Montag
  published    boolean not null default false,
  published_by text,
  published_at timestamptz,
  note         text not null default ''
);

create or replace function public.plan_weeks_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if extract(isodow from new.week_start)::int <> 1 then raise exception 'week_start muss ein Montag sein.'; end if;
  if new.published and (tg_op = 'INSERT' or not old.published) then
    new.published_by := public.current_staff_name();
    new.published_at := now();
  elsif not new.published then
    new.published_by := null;
    new.published_at := null;
  end if;
  return new;
end $$;
drop trigger if exists plan_weeks_stamp_trg on public.plan_weeks;
create trigger plan_weeks_stamp_trg before insert or update on public.plan_weeks
  for each row execute function public.plan_weeks_stamp();

create or replace function public.work_schedules_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists work_schedules_touch_trg on public.work_schedules;
create trigger work_schedules_touch_trg before update on public.work_schedules
  for each row execute function public.work_schedules_touch();

-- Ist die Woche veröffentlicht?
create or replace function public.week_is_published(p_week date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plan_weeks w where w.week_start = p_week and w.published)
$$;

alter table public.work_schedules enable row level security;
alter table public.plan_weeks     enable row level security;
select public.reset_policies('work_schedules');
select public.reset_policies('plan_weeks');

create policy ws_select on public.work_schedules for select
  using (public.is_admin() or (public.current_staff_id() is not null and public.week_is_published(week_start)));
create policy ws_insert on public.work_schedules for insert with check (public.is_admin());
create policy ws_update on public.work_schedules for update using (public.is_admin()) with check (public.is_admin());
create policy ws_delete on public.work_schedules for delete using (public.is_admin());

create policy pw_select on public.plan_weeks for select using (public.is_admin() or (public.current_staff_id() is not null and published));
create policy pw_insert on public.plan_weeks for insert with check (public.is_admin());
create policy pw_update on public.plan_weeks for update using (public.is_admin()) with check (public.is_admin());
create policy pw_delete on public.plan_weeks for delete using (public.is_admin());

grant select, insert, update, delete on public.work_schedules, public.plan_weeks to anon, authenticated;
grant usage, select on sequence public.work_schedules_id_seq to anon, authenticated;
