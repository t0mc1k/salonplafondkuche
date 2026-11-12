-- Version 3.2.03: Checklisten, Schichttausch, Stunden/Pausen, Speisekarte, Störungen, Fundsachen, Verluste
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Voraussetzung: die Hilfsfunktionen public.current_staff_name(), public.is_staff_admin()
-- und public.reset_policies(text) existieren bereits (sie werden vom Team-Chat, SQL 3.1.02, genutzt).

-- =====================================================================
-- 0) ARBEITSPLAN: nur Manager/Developer dürfen ändern
--    (Lesen: jede angemeldete Person, damit die Tauschbörse sieht, wer frei ist.)
--    ACHTUNG: Der Excel-Import des Arbeitsplans funktioniert danach nur noch für Manager/Developer.
-- =====================================================================
alter table public.work_schedules enable row level security;
select public.reset_policies('work_schedules');

create policy ws_read on public.work_schedules
  for select to public using (public.current_staff_name() is not null);
create policy ws_admin_write on public.work_schedules
  for all to public
  using (coalesce(public.is_staff_admin(), false))
  with check (coalesce(public.is_staff_admin(), false));

-- =====================================================================
-- 1) CHECKLISTEN (gemeinsame Liste pro Tag, Name + Uhrzeit beim Abhaken)
-- =====================================================================
create table if not exists public.checklist_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 120),
  area        text not null check (area in ('bar', 'service', 'terrasse')),
  phase       text not null check (phase in ('opening', 'closing', 'ongoing')),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
alter table public.checklist_tasks enable row level security;
select public.reset_policies('checklist_tasks');
create policy cl_tasks_read on public.checklist_tasks
  for select to public using (public.current_staff_name() is not null);
create policy cl_tasks_admin on public.checklist_tasks
  for all to public
  using (coalesce(public.is_staff_admin(), false))
  with check (coalesce(public.is_staff_admin(), false));

create table if not exists public.checklist_done (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.checklist_tasks(id) on delete cascade,
  work_date  date not null,
  done_by    text not null,
  done_at    timestamptz not null default now(),
  unique (task_id, work_date)
);
alter table public.checklist_done enable row level security;
select public.reset_policies('checklist_done');
create policy cl_done_read on public.checklist_done
  for select to public using (public.current_staff_name() is not null);
create policy cl_done_insert on public.checklist_done
  for insert to public
  with check (public.current_staff_name() is not null
              and lower(done_by) = lower(public.current_staff_name()));
create policy cl_done_delete on public.checklist_done
  for delete to public
  using (lower(done_by) = lower(coalesce(public.current_staff_name(), ''))
         or coalesce(public.is_staff_admin(), false));

-- Zeitstempel kommt immer vom Server
create or replace function public.checklist_done_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.done_at := now();
  return new;
end $$;
drop trigger if exists checklist_done_guard_trg on public.checklist_done;
create trigger checklist_done_guard_trg before insert on public.checklist_done
for each row execute function public.checklist_done_guard();

-- =====================================================================
-- 2) STUNDEN: Pause (Mitarbeiter) und Korrektur (Manager) pro Tag
--    Geschrieben wird nur über die Funktionen unten.
-- =====================================================================
create table if not exists public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  employee_name   text not null,
  work_date       date not null,
  break_minutes   int  not null default 0 check (break_minutes between 0 and 600),
  adjust_minutes  int  not null default 0 check (adjust_minutes between -720 and 720),
  note            text,
  updated_by      text,
  updated_at      timestamptz not null default now()
);
create unique index if not exists time_entries_unique on public.time_entries (lower(employee_name), work_date);
alter table public.time_entries enable row level security;
select public.reset_policies('time_entries');
create policy time_read on public.time_entries
  for select to public
  using (lower(employee_name) = lower(coalesce(public.current_staff_name(), ''))
         or coalesce(public.is_staff_admin(), false));

create or replace function public.set_my_break(p_date date, p_minutes int)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 600 then
    raise exception 'Pause: bitte 0 bis 600 Minuten eingeben.';
  end if;
  insert into public.time_entries (employee_name, work_date, break_minutes, updated_by)
  values (me, p_date, p_minutes, me)
  on conflict (lower(employee_name), work_date)
  do update set break_minutes = excluded.break_minutes, updated_by = me, updated_at = now();
end $$;

create or replace function public.set_time_entry(p_name text, p_date date, p_break int, p_adjust int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur Manager und Developer dürfen Stunden korrigieren.';
  end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Name fehlt.'; end if;
  insert into public.time_entries (employee_name, work_date, break_minutes, adjust_minutes, note, updated_by)
  values (btrim(p_name), p_date, coalesce(p_break, 0), coalesce(p_adjust, 0), nullif(btrim(coalesce(p_note, '')), ''), me)
  on conflict (lower(employee_name), work_date)
  do update set break_minutes  = coalesce(p_break, public.time_entries.break_minutes),
                adjust_minutes = coalesce(p_adjust, public.time_entries.adjust_minutes),
                note           = nullif(btrim(coalesce(p_note, '')), ''),
                updated_by     = me,
                updated_at     = now();
end $$;

-- =====================================================================
-- 3) SCHICHTTAUSCH (direkt an Kollegen oder in die Börse; Manager genehmigt)
--    Nur der Manager ändert am Ende den Arbeitsplan (Funktion decide_shift_swap).
-- =====================================================================
create table if not exists public.shift_swaps (
  id            uuid primary key default gen_random_uuid(),
  requester     text not null,
  work_date     date not null,
  shift_text    text,
  kind          text not null check (kind in ('direct', 'pool')),
  target_name   text,
  taker_name    text,
  note          text,
  status        text not null default 'open'
                check (status in ('open', 'awaiting_manager', 'approved', 'rejected', 'declined', 'cancelled')),
  manager_note  text,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (kind = 'pool' or target_name is not null)
);
alter table public.shift_swaps enable row level security;
select public.reset_policies('shift_swaps');
create policy swaps_read on public.shift_swaps
  for select to public
  using (coalesce(public.is_staff_admin(), false)
         or lower(requester) = lower(coalesce(public.current_staff_name(), ''))
         or lower(coalesce(target_name, '')) = lower(coalesce(public.current_staff_name(), '!'))
         or lower(coalesce(taker_name, '')) = lower(coalesce(public.current_staff_name(), '!'))
         or (kind = 'pool' and status = 'open'));

-- Hat die Person an diesem Tag eine echte Schicht? (Name wie im Arbeitsplan: enthält den Namen)
create or replace function public.swap_shift_row_name(p_name text, p_date date)
returns text language sql stable security definer set search_path = public as $$
  select employee_name
  from public.work_schedules
  where year  = extract(year  from p_date)::int
    and month = extract(month from p_date)::int
    and day   = extract(day   from p_date)::int
    and employee_name ilike '%' || p_name || '%'
    and coalesce(btrim(shift_1_start::text), '') <> ''
    and coalesce(btrim(shift_1_end::text), '')   <> ''
  limit 1;
$$;

create or replace function public.create_shift_swap(p_date date, p_kind text, p_target text, p_note text, p_shift_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); new_id uuid;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_kind not in ('direct', 'pool') then raise exception 'Ungültige Art.'; end if;
  if p_date < current_date - 1 then raise exception 'Vergangene Schichten können nicht getauscht werden.'; end if;
  if public.swap_shift_row_name(me, p_date) is null then
    raise exception 'Du hast an diesem Tag keine Schicht im Arbeitsplan.';
  end if;
  if exists (select 1 from public.shift_swaps
             where lower(requester) = lower(me) and work_date = p_date and status in ('open', 'awaiting_manager')) then
    raise exception 'Für diesen Tag gibt es schon eine offene Anfrage.';
  end if;
  if p_kind = 'direct' then
    if coalesce(btrim(p_target), '') = '' then raise exception 'Bitte einen Kollegen wählen.'; end if;
    if lower(btrim(p_target)) = lower(me) then raise exception 'Du kannst nicht mit dir selbst tauschen.'; end if;
    if public.swap_shift_row_name(btrim(p_target), p_date) is not null then
      raise exception '% hat an diesem Tag selbst eine Schicht.', p_target;
    end if;
  end if;
  insert into public.shift_swaps (requester, work_date, shift_text, kind, target_name, note)
  values (me, p_date, left(p_shift_text, 60), p_kind,
          case when p_kind = 'direct' then btrim(p_target) else null end,
          nullif(left(btrim(coalesce(p_note, '')), 200), ''))
  returning id into new_id;
  return new_id;
end $$;

-- Kollege nimmt an (direkt) bzw. übernimmt aus der Börse. Wer zuerst kommt, bekommt sie.
create or replace function public.take_shift_swap(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); s public.shift_swaps%rowtype;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  select * into s from public.shift_swaps where id = p_id for update;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
  if s.status <> 'open' then raise exception 'Diese Schicht ist leider nicht mehr verfügbar.'; end if;
  if lower(s.requester) = lower(me) then raise exception 'Das ist deine eigene Anfrage.'; end if;
  if s.kind = 'direct' and lower(coalesce(s.target_name, '')) <> lower(me) then
    raise exception 'Diese Anfrage ist an jemand anderen gerichtet.';
  end if;
  if public.swap_shift_row_name(me, s.work_date) is not null then
    raise exception 'Du hast an diesem Tag selbst schon eine Schicht.';
  end if;
  update public.shift_swaps set taker_name = me, status = 'awaiting_manager' where id = p_id;
end $$;

create or replace function public.decline_shift_swap(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); s public.shift_swaps%rowtype;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  select * into s from public.shift_swaps where id = p_id for update;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
  if s.kind <> 'direct' or lower(coalesce(s.target_name, '')) <> lower(me) or s.status <> 'open' then
    raise exception 'Diese Anfrage kann nicht abgelehnt werden.';
  end if;
  update public.shift_swaps set status = 'declined' where id = p_id;
end $$;

create or replace function public.cancel_shift_swap(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); s public.shift_swaps%rowtype;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  select * into s from public.shift_swaps where id = p_id for update;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
  if lower(s.requester) <> lower(me) and not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur die anfragende Person kann zurückziehen.';
  end if;
  if s.status not in ('open', 'awaiting_manager') then raise exception 'Schon entschieden, kann nicht mehr zurückgezogen werden.'; end if;
  update public.shift_swaps set status = 'cancelled' where id = p_id;
end $$;

-- Manager entscheidet. Bei „genehmigen“ wird die Schicht im Arbeitsplan auf die übernehmende Person umgeschrieben.
create or replace function public.decide_shift_swap(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); s public.shift_swaps%rowtype; row_name text; n int;
begin
  if not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur Manager und Developer dürfen entscheiden.';
  end if;
  select * into s from public.shift_swaps where id = p_id for update;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
  if s.status <> 'awaiting_manager' then raise exception 'Diese Anfrage wartet nicht auf eine Entscheidung.'; end if;

  if p_approve then
    row_name := public.swap_shift_row_name(s.requester, s.work_date);
    if row_name is null then raise exception 'Die Schicht von % existiert im Arbeitsplan nicht mehr.', s.requester; end if;
    if public.swap_shift_row_name(s.taker_name, s.work_date) is not null then
      raise exception '% hat an diesem Tag inzwischen selbst eine Schicht.', s.taker_name;
    end if;
    update public.work_schedules
       set employee_name = s.taker_name
     where year  = extract(year  from s.work_date)::int
       and month = extract(month from s.work_date)::int
       and day   = extract(day   from s.work_date)::int
       and employee_name = row_name;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'Arbeitsplan konnte nicht geändert werden.'; end if;
  end if;

  update public.shift_swaps
     set status = case when p_approve then 'approved' else 'rejected' end,
         manager_note = nullif(left(btrim(coalesce(p_note, '')), 200), ''),
         decided_by = me, decided_at = now()
   where id = p_id;
end $$;

-- =====================================================================
-- 4) SPEISEKARTE (Gerichte pro Saison mit Allergenen A–R)
-- =====================================================================
create table if not exists public.food_menus (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.food_items (
  id           uuid primary key default gen_random_uuid(),
  menu_id      uuid not null references public.food_menus(id) on delete cascade,
  category     text not null default 'Sonstiges',
  name         text not null check (length(btrim(name)) between 1 and 120),
  description  text,
  price        numeric(8, 2),
  allergens    text[] not null default '{}',
  available    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint food_items_allergens_valid
    check (allergens <@ array['A','B','C','D','E','F','G','H','L','M','N','O','P','R']::text[])
);
alter table public.food_menus enable row level security;
alter table public.food_items enable row level security;
select public.reset_policies('food_menus');
select public.reset_policies('food_items');
create policy food_menus_read on public.food_menus
  for select to public using (public.current_staff_name() is not null);
create policy food_menus_admin on public.food_menus
  for all to public
  using (coalesce(public.is_staff_admin(), false)) with check (coalesce(public.is_staff_admin(), false));
create policy food_items_read on public.food_items
  for select to public using (public.current_staff_name() is not null);
create policy food_items_admin on public.food_items
  for all to public
  using (coalesce(public.is_staff_admin(), false)) with check (coalesce(public.is_staff_admin(), false));

-- =====================================================================
-- 5) STÖRUNGEN (Geräte/Ausstattung; sichtbar für den Melder und Manager/Developer)
-- =====================================================================
create table if not exists public.maintenance_reports (
  id            uuid primary key default gen_random_uuid(),
  area          text not null,
  device        text not null,
  description   text,
  urgency       text not null default 'normal' check (urgency in ('normal', 'dringend', 'notfall')),
  photo_url     text,
  status        text not null default 'neu' check (status in ('neu', 'in_arbeit', 'erledigt')),
  reported_by   text not null,
  manager_note  text,
  resolved_by   text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.maintenance_reports enable row level security;
select public.reset_policies('maintenance_reports');
create policy maint_read on public.maintenance_reports
  for select to public
  using (coalesce(public.is_staff_admin(), false)
         or lower(reported_by) = lower(coalesce(public.current_staff_name(), '')));
create policy maint_insert on public.maintenance_reports
  for insert to public
  with check (public.current_staff_name() is not null
              and lower(reported_by) = lower(public.current_staff_name()));
create policy maint_update_admin on public.maintenance_reports
  for update to public
  using (coalesce(public.is_staff_admin(), false)) with check (coalesce(public.is_staff_admin(), false));
create policy maint_delete_admin on public.maintenance_reports
  for delete to public using (coalesce(public.is_staff_admin(), false));

create or replace function public.maintenance_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'neu';
    new.created_at := now();
    new.resolved_by := null;
    new.resolved_at := null;
    new.manager_note := null;
    return new;
  end if;
  new.reported_by := old.reported_by;
  new.created_at  := old.created_at;
  if new.status = 'erledigt' and old.status <> 'erledigt' then
    new.resolved_by := public.current_staff_name();
    new.resolved_at := now();
  elsif new.status <> 'erledigt' then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end $$;
drop trigger if exists maintenance_guard_trg on public.maintenance_reports;
create trigger maintenance_guard_trg before insert or update on public.maintenance_reports
for each row execute function public.maintenance_guard();

-- =====================================================================
-- 6) FUNDSACHEN (Nachweise vom Gast; kein Gast-Kontakt gespeichert)
-- =====================================================================
create table if not exists public.found_items (
  id             uuid primary key default gen_random_uuid(),
  description    text not null check (length(btrim(description)) between 1 and 300),
  found_place    text,
  found_at       timestamptz not null default now(),
  photo_url      text,
  storage_place  text,
  status         text not null default 'gelagert' check (status in ('gelagert', 'zurueckgegeben', 'entsorgt')),
  created_by     text not null,
  handled_by     text,
  handled_at     timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.found_items enable row level security;
select public.reset_policies('found_items');
create policy found_read on public.found_items
  for select to public using (public.current_staff_name() is not null);
create policy found_insert on public.found_items
  for insert to public
  with check (public.current_staff_name() is not null
              and lower(created_by) = lower(public.current_staff_name()));
create policy found_update on public.found_items
  for update to public
  using (public.current_staff_name() is not null) with check (public.current_staff_name() is not null);
create policy found_delete_admin on public.found_items
  for delete to public using (coalesce(public.is_staff_admin(), false));

create or replace function public.found_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.status := 'gelagert';
    new.handled_by := null;
    new.handled_at := null;
    return new;
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    if new.status = 'gelagert' then
      new.handled_by := null; new.handled_at := null;
    else
      new.handled_by := public.current_staff_name(); new.handled_at := now();
    end if;
  else
    new.handled_by := old.handled_by; new.handled_at := old.handled_at;
  end if;
  return new;
end $$;
drop trigger if exists found_guard_trg on public.found_items;
create trigger found_guard_trg before insert or update on public.found_items
for each row execute function public.found_guard();

-- =====================================================================
-- 7) VERLUSTE / BRUCH (Gläser, Verschüttetes, Abschreibungen)
-- =====================================================================
create table if not exists public.loss_reports (
  id           uuid primary key default gen_random_uuid(),
  item         text not null check (length(btrim(item)) between 1 and 120),
  quantity     int  not null default 1 check (quantity between 1 and 999),
  reason       text not null default 'bruch' check (reason in ('bruch', 'verschuettet', 'abschreibung', 'sonstiges')),
  note         text,
  loss_date    date not null default current_date,
  reported_by  text not null,
  created_at   timestamptz not null default now()
);
alter table public.loss_reports enable row level security;
select public.reset_policies('loss_reports');
create policy loss_read on public.loss_reports
  for select to public
  using (coalesce(public.is_staff_admin(), false)
         or lower(reported_by) = lower(coalesce(public.current_staff_name(), '')));
create policy loss_insert on public.loss_reports
  for insert to public
  with check (public.current_staff_name() is not null
              and lower(reported_by) = lower(public.current_staff_name()));
create policy loss_delete_admin on public.loss_reports
  for delete to public using (coalesce(public.is_staff_admin(), false));

create or replace function public.loss_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  return new;
end $$;
drop trigger if exists loss_guard_trg on public.loss_reports;
create trigger loss_guard_trg before insert on public.loss_reports
for each row execute function public.loss_guard();

-- Funktionen für die App freigeben
grant execute on function public.set_my_break(date, int) to anon, authenticated;
grant execute on function public.set_time_entry(text, date, int, int, text) to anon, authenticated;
grant execute on function public.create_shift_swap(date, text, text, text, text) to anon, authenticated;
grant execute on function public.take_shift_swap(uuid) to anon, authenticated;
grant execute on function public.decline_shift_swap(uuid) to anon, authenticated;
grant execute on function public.cancel_shift_swap(uuid) to anon, authenticated;
grant execute on function public.decide_shift_swap(uuid, boolean, text) to anon, authenticated;
