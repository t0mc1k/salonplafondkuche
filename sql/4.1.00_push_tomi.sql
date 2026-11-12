-- Version 4.1.00: Push-Benachrichtigungen + TomiAI (Gemini)
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Voraussetzungen: SQL 3.1.02 (current_staff_name, is_staff_admin, reset_policies)
-- und SQL 3.2.03 (Tabellen work_schedules, shift_swaps, maintenance_reports).
-- Danach: Schritte in docs/SETUP-4.1.00.md (Secrets, Edge Functions, shared_secret setzen).

-- =====================================================================
-- 0) Erweiterungen (pg_net sendet Anfragen an die Edge Function)
-- =====================================================================
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net konnte nicht aktiviert werden: % (bitte im Dashboard unter Database > Extensions aktivieren)', sqlerrm;
end $$;

-- =====================================================================
-- 1) Tabellen
-- =====================================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  staff_name  text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  lang        text not null default 'de',
  is_admin    boolean not null default false,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists push_subscriptions_name_idx on public.push_subscriptions (lower(staff_name));

create table if not exists public.push_prefs (
  staff_name  text primary key,                 -- klein geschrieben
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.push_queue (
  id           bigserial primary key,
  target_type  text not null check (target_type in ('user', 'admins', 'all')),
  target_name  text,
  exclude_name text,
  category     text not null,
  payload      jsonb not null,
  url          text,                            -- Ziel in der App (chat, swaps, myplan, faults, tickets, news)
  tag          text,
  send_after   timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts     int not null default 0,
  error        text,
  dedupe_key   text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create unique index if not exists push_queue_dedupe_idx on public.push_queue (dedupe_key)
  where status = 'pending' and dedupe_key is not null;
create index if not exists push_queue_due_idx on public.push_queue (status, send_after);

create table if not exists public.push_config (
  id            int primary key check (id = 1),
  function_url  text,
  shared_secret text
);
insert into public.push_config (id, function_url)
values (1, 'https://asrrkjcxqqvxzlikdkaq.supabase.co/functions/v1/send-push')
on conflict (id) do nothing;

create table if not exists public.tomi_usage (
  staff_name  text not null,
  day         date not null,
  n           int not null default 0,
  primary key (staff_name, day)
);

-- Alle fünf Tabellen: kein direkter Zugriff aus der App (nur über die Funktionen unten)
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs         enable row level security;
alter table public.push_queue         enable row level security;
alter table public.push_config        enable row level security;
alter table public.tomi_usage         enable row level security;
select public.reset_policies('push_subscriptions');
select public.reset_policies('push_prefs');
select public.reset_policies('push_queue');
select public.reset_policies('push_config');
select public.reset_policies('tomi_usage');

-- =====================================================================
-- 2) Funktionen für die App (Zugriff nur für angemeldete Mitarbeiter)
-- =====================================================================
create or replace function public.push_save_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Ungültige Push-Daten.';
  end if;
  insert into public.push_subscriptions (staff_name, endpoint, p256dh, auth, lang, is_admin, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'de' end,
          coalesce(public.is_staff_admin(), false), left(p_ua, 200))
  on conflict (endpoint) do update
    set staff_name = excluded.staff_name, p256dh = excluded.p256dh, auth = excluded.auth,
        lang = excluded.lang, is_admin = excluded.is_admin, user_agent = excluded.user_agent, last_seen = now();
end $$;

create or replace function public.push_remove_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then return; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and lower(staff_name) = lower(me);
end $$;

create or replace function public.push_get_prefs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := public.current_staff_name(); r jsonb;
begin
  if me is null then return '{}'::jsonb; end if;
  select prefs into r from public.push_prefs where staff_name = lower(me);
  return coalesce(r, '{}'::jsonb);
end $$;

create or replace function public.push_set_prefs(p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); k text;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if jsonb_typeof(p_prefs) <> 'object' then raise exception 'Ungültige Einstellungen.'; end if;
  for k in select jsonb_object_keys(p_prefs) loop
    if k not in ('chat', 'mention', 'plan', 'swap', 'news', 'mgr_swap', 'fault', 'fault_urgent', 'ticket') then
      raise exception 'Unbekannte Kategorie: %', k;
    end if;
    if jsonb_typeof(p_prefs -> k) <> 'boolean' then raise exception 'Ungültiger Wert für %', k; end if;
  end loop;
  insert into public.push_prefs (staff_name, prefs) values (lower(me), p_prefs)
  on conflict (staff_name) do update set prefs = excluded.prefs, updated_at = now();
end $$;

-- Test-Benachrichtigung an die eigene Person
create or replace function public.push_send_test()
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  perform public.push_enqueue('user', me, null, 'test',
    jsonb_build_object(
      'de', jsonb_build_object('title', '🔔 Test', 'body', 'Benachrichtigungen funktionieren. 👍'),
      'en', jsonb_build_object('title', '🔔 Test', 'body', 'Notifications are working. 👍')),
    'chat', 'test', interval '0', null);
end $$;

-- =====================================================================
-- 3) Warteschlange und Versand (nur für Trigger und Edge Function)
-- =====================================================================
create or replace function public.push_enqueue(
  p_type text, p_target text, p_exclude text, p_cat text, p_payload jsonb,
  p_url text, p_tag text, p_delay interval default interval '0', p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_queue (target_type, target_name, exclude_name, category, payload, url, tag, send_after, dedupe_key)
  values (p_type, p_target, p_exclude, p_cat, p_payload, p_url, p_tag, now() + p_delay, p_dedupe)
  on conflict (dedupe_key) where (status = 'pending' and dedupe_key is not null) do nothing;
exception when others then
  null;   -- eine Benachrichtigung darf nie das eigentliche Speichern verhindern
end $$;

-- Edge Function anstoßen (sendet alles, was fällig ist)
create or replace function public.push_kick()
returns void language plpgsql security definer set search_path = public as $$
declare cfg record;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg.function_url is null or coalesce(cfg.shared_secret, '') = '' then return; end if;
  begin
    perform net.http_post(
      url := cfg.function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.shared_secret),
      body := jsonb_build_object('kick', true));
  exception when others then
    null;
  end;
end $$;

create or replace function public.push_queue_kick()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.send_after <= now() + interval '2 seconds' then
    perform public.push_kick();
  end if;
  return new;
end $$;
drop trigger if exists push_queue_kick_trg on public.push_queue;
create trigger push_queue_kick_trg after insert on public.push_queue
for each row execute function public.push_queue_kick();

create or replace function public.push_claim_batch(p_limit int default 40)
returns setof public.push_queue language plpgsql security definer set search_path = public as $$
begin
  update public.push_queue set status = 'pending'
   where status = 'sending' and created_at < now() - interval '10 minutes' and attempts < 3;
  delete from public.push_queue where created_at < now() - interval '7 days' and status <> 'pending';
  return query
    update public.push_queue q set status = 'sending', attempts = q.attempts + 1
     where q.id in (select id from public.push_queue
                     where status = 'pending' and send_after <= now()
                     order by id limit p_limit for update skip locked)
    returning q.*;
end $$;

create or replace function public.push_finish(p_id bigint, p_status text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.push_queue set status = p_status, error = left(p_error, 300),
         sent_at = case when p_status in ('sent', 'skipped') then now() else sent_at end
   where id = p_id;
end $$;

-- =====================================================================
-- 4) Trigger: Ereignisse -> Benachrichtigungen
--    Alle Trigger fangen Fehler ab, damit Speichern nie blockiert wird.
-- =====================================================================
create or replace function public.push_excerpt(p text, p_len int default 90)
returns text language sql immutable as $$
  select case when length(btrim(coalesce(p, ''))) > p_len then left(btrim(p), p_len) || '…' else btrim(coalesce(p, '')) end;
$$;

-- 4a) Team-Chat
create or replace function public.push_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentions text[]; msg text := coalesce(new.message, ''); ex_de text; ex_en text; a text := coalesce(new.author_name, '');
begin
  begin
    select coalesce(array_agg(distinct lower(staff_name)), '{}') into mentions
      from public.push_subscriptions
     where lower(staff_name) <> lower(a) and position('@' || lower(staff_name) in lower(msg)) > 0;
    if btrim(msg) = '' then ex_de := '📷 Foto'; ex_en := '📷 Photo';
    else ex_de := public.push_excerpt(msg); ex_en := ex_de; end if;
    perform public.push_enqueue('all', null, a, 'chat',
      jsonb_build_object(
        'de', jsonb_build_object('title', '💬 ' || a, 'body', ex_de, 'groupTitle', '💬 Team-Chat', 'groupBody', '{n} neue Nachrichten'),
        'en', jsonb_build_object('title', '💬 ' || a, 'body', ex_en, 'groupTitle', '💬 Team Chat', 'groupBody', '{n} new messages'),
        'mentions', to_jsonb(mentions),
        'mention_de', jsonb_build_object('title', '@ ' || a || ' hat dich erwähnt', 'body', ex_de),
        'mention_en', jsonb_build_object('title', '@ ' || a || ' mentioned you', 'body', ex_en)),
      'chat', 'chat');
  exception when others then null;
  end;
  return new;
end $$;

-- 4b) Arbeitsplan (pro Person und Monat gebündelt, 2 Minuten Verzögerung: ein Import = eine Meldung)
create or replace function public.push_on_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; n1 text; n2 text; y int; mo int; me text := lower(coalesce(public.current_staff_name(), '')); lbl text;
begin
  begin
    if tg_op = 'DELETE' then n1 := old.employee_name; n2 := null; y := old.year; mo := old.month;
    elsif tg_op = 'INSERT' then n1 := new.employee_name; n2 := null; y := new.year; mo := new.month;
    else n1 := new.employee_name; n2 := old.employee_name; y := new.year; mo := new.month; end if;
    lbl := lpad(mo::text, 2, '0') || '/' || y::text;
    for r in
      select distinct staff_name from public.push_subscriptions
       where (lower(coalesce(n1, '')) like '%' || lower(staff_name) || '%' or lower(coalesce(n2, '')) like '%' || lower(staff_name) || '%')
         and lower(staff_name) <> me
    loop
      perform public.push_enqueue('user', r.staff_name, null, 'plan',
        jsonb_build_object(
          'de', jsonb_build_object('title', '🗓️ Dein Arbeitsplan wurde geändert', 'body', 'Plan ' || lbl || ': bitte kurz prüfen.'),
          'en', jsonb_build_object('title', '🗓️ Your schedule has changed', 'body', 'Schedule ' || lbl || ': please have a look.')),
        'myplan', 'plan', interval '2 minutes', 'plan:' || lower(r.staff_name) || ':' || y::text || '-' || mo::text);
    end loop;
  exception when others then null;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- 4c) Schichttausch
create or replace function public.push_on_swap()
returns trigger language plpgsql security definer set search_path = public as $$
declare d text; sh text;
begin
  begin
    d := to_char(new.work_date, 'DD.MM.YYYY'); sh := coalesce(new.shift_text, '');
    if tg_op = 'INSERT' then
      if new.kind = 'direct' then
        perform public.push_enqueue('user', new.target_name, null, 'swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', '🔄 ' || new.requester || ' möchte tauschen', 'body', d || ' · ' || sh),
            'en', jsonb_build_object('title', '🔄 ' || new.requester || ' wants to swap', 'body', d || ' · ' || sh)),
          'swaps', 'swap');
      else
        perform public.push_enqueue('all', null, new.requester, 'swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', '📢 Neue Schicht in der Börse', 'body', new.requester || ' · ' || d || ' · ' || sh),
            'en', jsonb_build_object('title', '📢 New shift on the board', 'body', new.requester || ' · ' || d || ' · ' || sh)),
          'swaps', 'swap');
      end if;
    elsif new.status is distinct from old.status then
      if new.status = 'awaiting_manager' then
        perform public.push_enqueue('admins', null, null, 'mgr_swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', '✅ Tausch wartet auf Genehmigung', 'body', new.requester || ' → ' || coalesce(new.taker_name, '?') || ' · ' || d),
            'en', jsonb_build_object('title', '✅ Swap waiting for approval', 'body', new.requester || ' → ' || coalesce(new.taker_name, '?') || ' · ' || d)),
          'swaps', 'mgr_swap');
        perform public.push_enqueue('user', new.requester, null, 'swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', '🔄 ' || coalesce(new.taker_name, '?') || ' übernimmt deine Schicht', 'body', d || ' · wartet auf den Manager'),
            'en', jsonb_build_object('title', '🔄 ' || coalesce(new.taker_name, '?') || ' takes your shift', 'body', d || ' · waiting for the manager')),
          'swaps', 'swap');
      elsif new.status in ('approved', 'rejected') then
        perform public.push_enqueue('user', new.requester, null, 'swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', case when new.status = 'approved' then '✅ Tausch genehmigt' else '❌ Tausch abgelehnt' end, 'body', d || ' · ' || sh),
            'en', jsonb_build_object('title', case when new.status = 'approved' then '✅ Swap approved' else '❌ Swap rejected' end, 'body', d || ' · ' || sh)),
          'swaps', 'swap');
        if new.taker_name is not null then
          perform public.push_enqueue('user', new.taker_name, null, 'swap',
            jsonb_build_object(
              'de', jsonb_build_object('title', case when new.status = 'approved' then '✅ Tausch genehmigt' else '❌ Tausch abgelehnt' end, 'body', d || ' · ' || sh),
              'en', jsonb_build_object('title', case when new.status = 'approved' then '✅ Swap approved' else '❌ Swap rejected' end, 'body', d || ' · ' || sh)),
            'swaps', 'swap');
        end if;
      elsif new.status = 'declined' then
        perform public.push_enqueue('user', new.requester, null, 'swap',
          jsonb_build_object(
            'de', jsonb_build_object('title', '❌ ' || coalesce(new.target_name, '?') || ' hat abgelehnt', 'body', d || ' · ' || sh),
            'en', jsonb_build_object('title', '❌ ' || coalesce(new.target_name, '?') || ' declined', 'body', d || ' · ' || sh)),
          'swaps', 'swap');
      end if;
    end if;
  exception when others then null;
  end;
  return new;
end $$;

-- 4d) Störungen -> Manager/Developer
create or replace function public.push_on_fault()
returns trigger language plpgsql security definer set search_path = public as $$
declare cat text; tde text; ten text;
begin
  begin
    cat := case when new.urgency in ('dringend', 'notfall') then 'fault_urgent' else 'fault' end;
    tde := case new.urgency when 'notfall' then '🚨 Notfall: ' when 'dringend' then '⚠️ Dringend: ' else '🛠️ Neue Störung: ' end || new.device;
    ten := case new.urgency when 'notfall' then '🚨 Emergency: ' when 'dringend' then '⚠️ Urgent: ' else '🛠️ New fault: ' end || new.device;
    perform public.push_enqueue('admins', null, new.reported_by, cat,
      jsonb_build_object(
        'de', jsonb_build_object('title', tde, 'body', new.area || case when coalesce(new.description, '') <> '' then ': ' || public.push_excerpt(new.description) else '' end),
        'en', jsonb_build_object('title', ten, 'body', new.area || case when coalesce(new.description, '') <> '' then ': ' || public.push_excerpt(new.description) else '' end)),
      'faults', 'fault');
  exception when others then null;
  end;
  return new;
end $$;

-- 4e) Tickets (Manager) und Team-News (alle)
create or replace function public.push_on_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text := split_part(coalesce(new.author_email, ''), ' (', 1);
begin
  begin
    if coalesce(new.is_changelog, false) then
      perform public.push_enqueue('all', null, who, 'news',
        jsonb_build_object(
          'de', jsonb_build_object('title', '📣 Neu im Team', 'body', public.push_excerpt(new.message)),
          'en', jsonb_build_object('title', '📣 New for the team', 'body', public.push_excerpt(new.message))),
        'news', 'news');
    else
      perform public.push_enqueue('admins', null, who, 'ticket',
        jsonb_build_object(
          'de', jsonb_build_object('title', '🛟 Neues Ticket' || case when who <> '' then ' von ' || who else '' end, 'body', public.push_excerpt(new.message)),
          'en', jsonb_build_object('title', '🛟 New ticket' || case when who <> '' then ' from ' || who else '' end, 'body', public.push_excerpt(new.message))),
        'tickets', 'ticket');
    end if;
  exception when others then null;
  end;
  return new;
end $$;

do $$ begin
  drop trigger if exists push_trg_chat on public.team_chat;
  create trigger push_trg_chat after insert on public.team_chat for each row execute function public.push_on_chat();
exception when undefined_table then raise notice 'Tabelle team_chat fehlt: Chat-Trigger übersprungen'; end $$;

do $$ begin
  drop trigger if exists push_trg_schedule on public.work_schedules;
  create trigger push_trg_schedule after insert or update or delete on public.work_schedules for each row execute function public.push_on_schedule();
exception when undefined_table then raise notice 'Tabelle work_schedules fehlt: Plan-Trigger übersprungen'; end $$;

do $$ begin
  drop trigger if exists push_trg_swap on public.shift_swaps;
  create trigger push_trg_swap after insert or update on public.shift_swaps for each row execute function public.push_on_swap();
exception when undefined_table then raise notice 'Tabelle shift_swaps fehlt (SQL 3.2.03): Tausch-Trigger übersprungen'; end $$;

do $$ begin
  drop trigger if exists push_trg_fault on public.maintenance_reports;
  create trigger push_trg_fault after insert on public.maintenance_reports for each row execute function public.push_on_fault();
exception when undefined_table then raise notice 'Tabelle maintenance_reports fehlt (SQL 3.2.03): Störungs-Trigger übersprungen'; end $$;

do $$ begin
  drop trigger if exists push_trg_ticket on public.support_tickets;
  create trigger push_trg_ticket after insert on public.support_tickets for each row execute function public.push_on_ticket();
exception when undefined_table then raise notice 'Tabelle support_tickets fehlt: Ticket-Trigger übersprungen'; end $$;

-- =====================================================================
-- 5) Regelmäßiger Anstoß (jede Minute): sendet verzögerte Meldungen (Arbeitsplan) und wiederholt Fehlversuche
--    Benötigt die Erweiterung pg_cron (Dashboard > Database > Extensions > pg_cron aktivieren, dann dieses Skript erneut ausführen).
-- =====================================================================
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'salon-push-flush';
    perform cron.schedule('salon-push-flush', '* * * * *', 'select public.push_kick()');
    raise notice 'pg_cron-Job salon-push-flush angelegt.';
  else
    raise notice 'pg_cron ist nicht aktiv: verzögerte Meldungen (Arbeitsplan) werden erst beim nächsten Ereignis gesendet.';
  end if;
exception when others then
  raise notice 'pg_cron-Job konnte nicht angelegt werden: %', sqlerrm;
end $$;

-- =====================================================================
-- 6) TomiAI: Identität prüfen und Tageslimit
-- =====================================================================
create or replace function public.tomi_whoami()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', public.current_staff_name(), 'is_admin', coalesce(public.is_staff_admin(), false));
$$;

create or replace function public.tomi_use(p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(public.current_staff_name(), '')); c int;
begin
  if me = '' then raise exception 'Nicht angemeldet.'; end if;
  insert into public.tomi_usage (staff_name, day, n) values (me, current_date, 1)
  on conflict (staff_name, day) do update set n = public.tomi_usage.n + 1
  returning n into c;
  if c > p_limit then raise exception 'quota'; end if;
  return p_limit - c;
end $$;

-- =====================================================================
-- 7) Berechtigungen
-- =====================================================================
revoke all on function public.push_enqueue(text, text, text, text, jsonb, text, text, interval, text) from public, anon, authenticated;
revoke all on function public.push_kick() from public, anon, authenticated;
revoke all on function public.push_claim_batch(int) from public, anon, authenticated;
revoke all on function public.push_finish(bigint, text, text) from public, anon, authenticated;
grant execute on function public.push_claim_batch(int) to service_role;
grant execute on function public.push_finish(bigint, text, text) to service_role;

grant execute on function public.push_save_subscription(text, text, text, text, text) to anon, authenticated;
grant execute on function public.push_remove_subscription(text) to anon, authenticated;
grant execute on function public.push_get_prefs() to anon, authenticated;
grant execute on function public.push_set_prefs(jsonb) to anon, authenticated;
grant execute on function public.push_send_test() to anon, authenticated;
grant execute on function public.tomi_whoami() to anon, authenticated;
grant execute on function public.tomi_use(int) to anon, authenticated;
