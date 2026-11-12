-- Version 4.1.04 (SQL-Datei, ersetzt 4.1.03): Login-Protokoll (Sitzungen + Aktivität), genauer Online-Status (3 Minuten),
--                 Begrüßungsanimation pro Konto
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.) Mehrfach ausführbar.
--
-- WICHTIG: Alle neuen Tabellen/Funktionen beginnen mit „nx_“, damit nichts mit bestehenden Objekten der App
--          (z. B. der vorhandenen Tabelle staff_sessions für die Anmelde-Token) kollidiert. Die alte Tabelle bleibt unberührt.
--
-- Datenschutz: Es werden KEINE IP-Adressen gespeichert. Daten werden nach 90 Tagen automatisch gelöscht;
-- der Manager kann das Protokoll jederzeit manuell leeren (App: Login-Protokoll -> „Protokoll leeren“).
-- Voraussetzung: SQL 3.1.02 (current_staff_name, is_staff_admin, reset_policies).

-- =====================================================================
-- 1) Tabellen (kein direkter Zugriff aus der App, nur über Funktionen)
-- =====================================================================
create table if not exists public.nx_sessions (
  id              uuid primary key default gen_random_uuid(),
  staff_name      text not null,
  device          text,
  app_version     text,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  ended_at        timestamptz,
  end_reason      text check (end_reason in ('logout', 'timeout', 'closed')),
  current_section text
);
create index if not exists nx_sessions_started_idx on public.nx_sessions (started_at desc);
create index if not exists nx_sessions_name_idx    on public.nx_sessions (lower(staff_name), started_at desc);
create index if not exists nx_sessions_open_idx    on public.nx_sessions (last_seen_at) where ended_at is null;

create table if not exists public.nx_activity (
  id          bigserial primary key,
  staff_name  text not null,
  session_id  uuid,
  kind        text not null check (kind in ('section', 'action')),
  event       text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists nx_activity_time_idx on public.nx_activity (created_at desc);
create index if not exists nx_activity_name_idx on public.nx_activity (lower(staff_name), created_at desc);

alter table public.nx_sessions enable row level security;
alter table public.nx_activity enable row level security;
select public.reset_policies('nx_sessions');
select public.reset_policies('nx_activity');

-- =====================================================================
-- 2) Anwesenheit: Sitzung starten, alle 60 Sekunden „ping“, beenden
-- =====================================================================
create or replace function public.nx_presence_start(p_device text, p_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); sid uuid;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  -- alte, nie beendete Sitzungen dieser Person abschließen
  update public.nx_sessions set ended_at = last_seen_at, end_reason = 'timeout'
   where lower(staff_name) = lower(me) and ended_at is null and last_seen_at < now() - interval '15 minutes';
  -- Aufbewahrung: 90 Tage
  delete from public.nx_activity where created_at < now() - interval '90 days';
  delete from public.nx_sessions where started_at < now() - interval '90 days';
  insert into public.nx_sessions (staff_name, device, app_version)
  values (me, left(p_device, 80), left(p_version, 20))
  returning id into sid;
  return sid;
end $$;

create or replace function public.nx_log_events(p_sid uuid, p_me text, p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare ev jsonb; k text; d text; n int := 0;
begin
  if jsonb_typeof(p_events) <> 'array' then return; end if;
  for ev in select * from jsonb_array_elements(p_events) loop
    n := n + 1; exit when n > 30;
    k := ev ->> 'k'; d := left(coalesce(ev ->> 'd', ''), 80);
    if k = 'section' and d <> '' then
      insert into public.nx_activity (staff_name, session_id, kind, event, detail) values (p_me, p_sid, 'section', 'section', d);
    end if;
  end loop;
end $$;

create or replace function public.nx_presence_ping(p_sid uuid, p_section text, p_events jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); n int;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  update public.nx_sessions set last_seen_at = now(), current_section = left(p_section, 40)
   where id = p_sid and lower(staff_name) = lower(me) and ended_at is null;
  get diagnostics n = row_count;
  if n > 0 then perform public.nx_log_events(p_sid, me, p_events); end if;
  return jsonb_build_object(
    'session', n > 0,
    'online', (select coalesce(jsonb_agg(jsonb_build_object('name', q.nm, 'age_s', q.age)), '[]'::jsonb)
                 from (select staff_name as nm, extract(epoch from (now() - max(last_seen_at)))::int as age
                         from public.nx_sessions
                        where ended_at is null and last_seen_at > now() - interval '10 minutes'
                        group by staff_name) q));
end $$;

create or replace function public.nx_presence_end(p_sid uuid, p_reason text, p_events jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then return; end if;
  perform public.nx_log_events(p_sid, me, p_events);
  update public.nx_sessions
     set ended_at = now(), last_seen_at = now(), end_reason = case when p_reason in ('logout', 'timeout', 'closed') then p_reason else 'logout' end
   where id = p_sid and lower(staff_name) = lower(me) and ended_at is null;
end $$;

-- =====================================================================
-- 3) Interne Hilfsfunktion für Aktivitäts-Einträge (nur Trigger)
-- =====================================================================
create or replace function public.nx_act_log(p_name text, p_event text, p_detail text, p_throttle interval default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_name), '') = '' then return; end if;
  if p_throttle is not null and exists (
       select 1 from public.nx_activity
        where lower(staff_name) = lower(p_name) and event = p_event and created_at > now() - p_throttle) then
    return;
  end if;
  insert into public.nx_activity (staff_name, kind, event, detail) values (btrim(p_name), 'action', p_event, left(p_detail, 200));
exception when others then null;   -- Protokoll darf nie das Speichern verhindern
end $$;

-- 3a) Checkliste
create or replace function public.nx_act_on_checklist() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from public.checklist_tasks where id = new.task_id;
  perform public.nx_act_log(new.done_by, 'task_done', coalesce(t, '?'));
  return new;
end $$;
-- 3b) Schichttausch
create or replace function public.nx_act_on_swap() returns trigger language plpgsql security definer set search_path = public as $$
declare d text := to_char(new.work_date, 'DD.MM.');
begin
  if tg_op = 'INSERT' then
    perform public.nx_act_log(new.requester, 'swap_request', d || ' · ' || case when new.kind = 'pool' then 'Börse' else 'an ' || coalesce(new.target_name, '?') end);
  elsif new.status is distinct from old.status then
    if new.status = 'awaiting_manager' then perform public.nx_act_log(new.taker_name, 'swap_take', d || ' von ' || new.requester);
    elsif new.status in ('approved', 'rejected') then perform public.nx_act_log(coalesce(new.decided_by, public.current_staff_name()), 'swap_decide', d || ' ' || new.requester || ' → ' || coalesce(new.taker_name, '?') || ': ' || case when new.status = 'approved' then 'genehmigt' else 'abgelehnt' end);
    elsif new.status = 'declined' then perform public.nx_act_log(new.target_name, 'swap_decline', d || ' von ' || new.requester);
    elsif new.status = 'cancelled' then perform public.nx_act_log(new.requester, 'swap_cancel', d);
    end if;
  end if;
  return new;
end $$;
-- 3c) Störungen
create or replace function public.nx_act_on_fault() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.nx_act_log(new.reported_by, 'fault_report', new.device || ' (' || new.urgency || ')');
  elsif new.status is distinct from old.status then perform public.nx_act_log(public.current_staff_name(), 'fault_status', new.device || ' → ' || new.status);
  end if;
  return new;
end $$;
-- 3d) Verluste / Bruch
create or replace function public.nx_act_on_loss() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.nx_act_log(new.reported_by, 'loss_report', new.quantity::text || '× ' || new.item || ' (' || new.reason || ')');
  return new;
end $$;
-- 3e) Fundsachen
create or replace function public.nx_act_on_found() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.nx_act_log(new.created_by, 'found_new', new.description);
  elsif new.status is distinct from old.status then perform public.nx_act_log(coalesce(new.handled_by, public.current_staff_name()), 'found_status', new.description || ' → ' || new.status);
  end if;
  return new;
end $$;
-- 3f) Arbeitsplan (gebündelt: höchstens ein Eintrag pro Person und Minute)
create or replace function public.nx_act_on_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare y int; mo int;
begin
  if tg_op = 'DELETE' then y := old.year; mo := old.month; else y := new.year; mo := new.month; end if;
  perform public.nx_act_log(public.current_staff_name(), 'plan_change', 'Arbeitsplan ' || lpad(mo::text, 2, '0') || '/' || y::text, interval '60 seconds');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
-- 3g) Getränke (Import wird gebündelt)
create or replace function public.nx_act_on_drink() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.nx_act_log(public.current_staff_name(), 'drink_new', new.name, interval '3 seconds'); return new;
  elsif tg_op = 'UPDATE' then perform public.nx_act_log(public.current_staff_name(), 'drink_edit', new.name, interval '3 seconds'); return new;
  else perform public.nx_act_log(public.current_staff_name(), 'drink_delete', old.name, interval '3 seconds'); return old;
  end if;
end $$;
-- 3h) Chat (nur „hat geschrieben“, nie der Inhalt; höchstens alle 5 Minuten)
create or replace function public.nx_act_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.nx_act_log(new.author_name, 'chat_msg', 'Chat-Nachricht gesendet', interval '5 minutes');
  return new;
end $$;
-- 3i) Tickets
create or replace function public.nx_act_on_ticket() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.nx_act_log(split_part(coalesce(new.author_email, ''), ' (', 1), case when coalesce(new.is_changelog, false) then 'news_new' else 'ticket_new' end, left(coalesce(new.message, ''), 60));
  return new;
end $$;

do $$ begin drop trigger if exists nx_trg_checklist on public.checklist_done;
  create trigger nx_trg_checklist after insert on public.checklist_done for each row execute function public.nx_act_on_checklist();
exception when undefined_table then raise notice 'checklist_done fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_swap on public.shift_swaps;
  create trigger nx_trg_swap after insert or update on public.shift_swaps for each row execute function public.nx_act_on_swap();
exception when undefined_table then raise notice 'shift_swaps fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_fault on public.maintenance_reports;
  create trigger nx_trg_fault after insert or update on public.maintenance_reports for each row execute function public.nx_act_on_fault();
exception when undefined_table then raise notice 'maintenance_reports fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_loss on public.loss_reports;
  create trigger nx_trg_loss after insert on public.loss_reports for each row execute function public.nx_act_on_loss();
exception when undefined_table then raise notice 'loss_reports fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_found on public.found_items;
  create trigger nx_trg_found after insert or update on public.found_items for each row execute function public.nx_act_on_found();
exception when undefined_table then raise notice 'found_items fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_plan on public.work_schedules;
  create trigger nx_trg_plan after insert or update or delete on public.work_schedules for each row execute function public.nx_act_on_plan();
exception when undefined_table then raise notice 'work_schedules fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_drink on public.drinks;
  create trigger nx_trg_drink after insert or update or delete on public.drinks for each row execute function public.nx_act_on_drink();
exception when undefined_table then raise notice 'drinks fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_chat on public.team_chat;
  create trigger nx_trg_chat after insert on public.team_chat for each row execute function public.nx_act_on_chat();
exception when undefined_table then raise notice 'team_chat fehlt'; end $$;
do $$ begin drop trigger if exists nx_trg_ticket on public.support_tickets;
  create trigger nx_trg_ticket after insert on public.support_tickets for each row execute function public.nx_act_on_ticket();
exception when undefined_table then raise notice 'support_tickets fehlt'; end $$;

-- =====================================================================
-- 4) Auswertungen für Manager/Developer
-- =====================================================================
create or replace function public.nx_admin_live()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then raise exception 'Nur Manager und Developer.'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by x.age_s), '[]'::jsonb) from (
    select staff_name, device, current_section as section, started_at,
           extract(epoch from (now() - last_seen_at))::int as age_s,
           extract(epoch from (last_seen_at - started_at))::int as seconds
      from public.nx_sessions
     where ended_at is null and last_seen_at > now() - interval '10 minutes') x);
end $$;

create or replace function public.nx_admin_sessions(p_from date, p_to date, p_name text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then raise exception 'Nur Manager und Developer.'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by x.started_at desc), '[]'::jsonb) from (
    select staff_name, device, app_version, started_at, last_seen_at, ended_at, end_reason,
           least(extract(epoch from (coalesce(ended_at, last_seen_at) - started_at))::int, 54000) as seconds,
           (ended_at is null and last_seen_at > now() - interval '5 minutes') as active
      from public.nx_sessions
     where started_at >= p_from::timestamptz and started_at < (p_to + 1)::timestamptz
       and (p_name is null or p_name = '' or lower(staff_name) = lower(p_name))
     order by started_at desc limit 500) x);
end $$;

create or replace function public.nx_admin_activity(p_from date, p_to date, p_name text default null, p_kind text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then raise exception 'Nur Manager und Developer.'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb) from (
    select staff_name, kind, event, detail, created_at
      from public.nx_activity
     where created_at >= p_from::timestamptz and created_at < (p_to + 1)::timestamptz
       and (p_name is null or p_name = '' or lower(staff_name) = lower(p_name))
       and (p_kind is null or p_kind = '' or kind = p_kind)
     order by created_at desc limit 1000) x);
end $$;

create or replace function public.nx_admin_stats(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then raise exception 'Nur Manager und Developer.'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by x.seconds desc), '[]'::jsonb) from (
    select s.staff_name,
           count(*)::int as sessions,
           sum(least(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at))::int, 54000))::int as seconds,
           max(s.last_seen_at) as last_seen,
           (select coalesce(jsonb_agg(jsonb_build_object('section', z.detail, 'n', z.n)), '[]'::jsonb) from (
              select a.detail, count(*)::int as n from public.nx_activity a
               where lower(a.staff_name) = lower(s.staff_name) and a.kind = 'section'
                 and a.created_at >= p_from::timestamptz and a.created_at < (p_to + 1)::timestamptz
               group by a.detail order by count(*) desc limit 3) z) as top_sections,
           (select count(*)::int from public.nx_activity a
             where lower(a.staff_name) = lower(s.staff_name) and a.kind = 'action'
               and a.created_at >= p_from::timestamptz and a.created_at < (p_to + 1)::timestamptz) as actions
      from public.nx_sessions s
     where s.started_at >= p_from::timestamptz and s.started_at < (p_to + 1)::timestamptz
     group by s.staff_name) x);
end $$;

create or replace function public.nx_admin_clear()
returns int language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  if not coalesce(public.is_staff_admin(), false) then raise exception 'Nur Manager und Developer.'; end if;
  delete from public.nx_activity; get diagnostics a = row_count;
  delete from public.nx_sessions where ended_at is not null or last_seen_at < now() - interval '15 minutes'; get diagnostics b = row_count;
  return a + b;
end $$;

-- =====================================================================
-- 5) Einstellungen pro Konto: Startseite + Begrüßungsanimation
-- =====================================================================
create table if not exists public.staff_prefs (
  staff_name  text primary key,
  start_page  text not null default 'dashboard' check (start_page in ('dashboard', 'drinks')),
  updated_at  timestamptz not null default now()
);
alter table public.staff_prefs add column if not exists intro_enabled boolean not null default true;
alter table public.staff_prefs enable row level security;

create or replace function public.get_my_ui_prefs()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('start_page', start_page, 'intro', intro_enabled)
       from public.staff_prefs where staff_name = lower(public.current_staff_name())),
    jsonb_build_object('start_page', 'dashboard', 'intro', true));
$$;

create or replace function public.set_my_intro(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  insert into public.staff_prefs (staff_name, intro_enabled) values (lower(me), coalesce(p_on, true))
  on conflict (staff_name) do update set intro_enabled = coalesce(p_on, true), updated_at = now();
end $$;

-- =====================================================================
-- 6) Berechtigungen
-- =====================================================================
revoke all on function public.nx_log_events(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.nx_act_log(text, text, text, interval) from public, anon, authenticated;

grant execute on function public.nx_presence_start(text, text) to anon, authenticated;
grant execute on function public.nx_presence_ping(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.nx_presence_end(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.nx_admin_live() to anon, authenticated;
grant execute on function public.nx_admin_sessions(date, date, text) to anon, authenticated;
grant execute on function public.nx_admin_activity(date, date, text, text) to anon, authenticated;
grant execute on function public.nx_admin_stats(date, date) to anon, authenticated;
grant execute on function public.nx_admin_clear() to anon, authenticated;
grant execute on function public.get_my_ui_prefs() to anon, authenticated;
grant execute on function public.set_my_intro(boolean) to anon, authenticated;
