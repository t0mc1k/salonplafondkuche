-- Version 4.1.07: Mitteilungen (Glocke im Dashboard) – unabhängig von Push auf dem Gerät
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Idee: Alles, was bisher eine Push-Meldung auslöst (genehmigter Urlaub, Schichttausch, neuer Arbeitsplan, ...),
-- wird zusätzlich hier gespeichert. Die App zeigt „🔔 3 neu“ unter dem Datum. Wer Push auf dem Gerät nicht
-- bekommt, sieht trotzdem, dass etwas Neues da ist. Chat-Nachrichten sind ausgenommen (eigener Zähler).
--
-- Voraussetzungen (bereits vorhanden): public.current_staff_name(), public.is_staff_admin(),
-- public.reset_policies(text), public.push_enqueue(...) und public.push_prefs (SQL 4.1.00).

-- =====================================================================
-- 1) Tabellen
-- =====================================================================
create table if not exists public.inbox_items (
  id           bigserial primary key,
  target_type  text not null check (target_type in ('user', 'admins', 'all')),
  target_name  text,                 -- bei 'user': Name der Person
  exclude_name text,                 -- wer es ausgelöst hat (sieht es nicht)
  category     text not null,        -- wie bei Push: swap, plan, absence, mgr_absence, ...
  payload      jsonb not null,       -- {de:{title,body}, en:{title,body}}
  url          text,                 -- Ziel in der App (swaps, myplan, absence, ...)
  dedupe_key   text,
  created_at   timestamptz not null default now()
);
create unique index if not exists inbox_items_dedupe_idx on public.inbox_items (dedupe_key) where dedupe_key is not null;
create index if not exists inbox_items_created_idx on public.inbox_items (created_at desc);

-- Pro Person: bis wann alles gelesen wurde (Öffnen des Fensters = alles gelesen)
create table if not exists public.inbox_state (
  staff_name text primary key,       -- immer klein geschrieben
  read_at    timestamptz not null default now()
);

alter table public.inbox_items enable row level security;
alter table public.inbox_state enable row level security;
select public.reset_policies('inbox_items');   -- keine Policies: Zugriff nur über die Funktionen unten
select public.reset_policies('inbox_state');

-- =====================================================================
-- 2) push_enqueue speichert zusätzlich in die Mitteilungen (gleiche Parameter wie bisher)
-- =====================================================================
create or replace function public.push_enqueue(
  p_type text, p_target text, p_exclude text, p_cat text, p_payload jsonb,
  p_url text, p_tag text, p_delay interval default interval '0', p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.push_queue (target_type, target_name, exclude_name, category, payload, url, tag, send_after, dedupe_key)
    values (p_type, p_target, p_exclude, p_cat, p_payload, p_url, p_tag, now() + p_delay, p_dedupe)
    on conflict (dedupe_key) where (status = 'pending' and dedupe_key is not null) do nothing;
  exception when others then
    null;   -- eine Benachrichtigung darf nie das eigentliche Speichern verhindern
  end;
  begin
    if p_cat not in ('chat', 'mention', 'test') then
      insert into public.inbox_items (target_type, target_name, exclude_name, category, payload, url, dedupe_key)
      values (p_type, p_target, p_exclude, p_cat, p_payload, p_url, case when p_dedupe is null then null else 'i:' || p_dedupe end)
      on conflict (dedupe_key) where dedupe_key is not null
      do update set created_at = now(), payload = excluded.payload, exclude_name = excluded.exclude_name;
    end if;
  exception when others then
    null;
  end;
end $$;

-- =====================================================================
-- 3) Funktionen für die App
-- =====================================================================
-- Sichtbare Einträge der angemeldeten Person (letzte 30 Tage, ohne eigene Aktionen, ohne abgeschaltete Kategorien)
create or replace function public.inbox_visible()
returns setof public.inbox_items language sql stable security definer set search_path = public as $$
  select i.* from public.inbox_items i
  where i.created_at > now() - interval '30 days'
    and (i.exclude_name is null or lower(i.exclude_name) <> lower(coalesce(public.current_staff_name(), '')))
    and (
      i.target_type = 'all'
      or (i.target_type = 'admins' and coalesce(public.is_staff_admin(), false))
      or (i.target_type = 'user' and lower(coalesce(i.target_name, '')) = lower(coalesce(public.current_staff_name(), '')))
    )
    and not exists (
      select 1 from public.push_prefs p
      where p.staff_name = lower(coalesce(public.current_staff_name(), ''))
        and (p.prefs ->> i.category) = 'false'
    );
$$;

-- Liste für das Fenster (neueste zuerst)
create or replace function public.inbox_list(p_limit int default 40)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(public.current_staff_name(), '')); seen timestamptz; res jsonb;
begin
  if me = '' then raise exception 'Nicht angemeldet.'; end if;
  select read_at into seen from public.inbox_state where staff_name = me;
  select jsonb_build_object(
    'read_at', seen,
    'items', coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'category', v.category, 'payload', v.payload, 'url', v.url,
        'created_at', v.created_at, 'unread', (seen is null or v.created_at > seen)) order by v.created_at desc), '[]'::jsonb))
  into res
  from (select * from public.inbox_visible() order by created_at desc limit greatest(1, least(coalesce(p_limit, 40), 100))) v;
  return res;
end $$;

-- Anzahl ungelesen (für das Dashboard)
create or replace function public.inbox_unread_count()
returns int language plpgsql stable security definer set search_path = public as $$
declare me text := lower(coalesce(public.current_staff_name(), '')); seen timestamptz; n int;
begin
  if me = '' then return 0; end if;
  select read_at into seen from public.inbox_state where staff_name = me;
  select count(*)::int into n from public.inbox_visible() v where (seen is null or v.created_at > seen);
  return coalesce(n, 0);
end $$;

-- Alles als gelesen markieren (und alte Einträge aufräumen)
create or replace function public.inbox_mark_read()
returns void language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(public.current_staff_name(), ''));
begin
  if me = '' then raise exception 'Nicht angemeldet.'; end if;
  insert into public.inbox_state (staff_name, read_at) values (me, now())
  on conflict (staff_name) do update set read_at = now();
  delete from public.inbox_items where created_at < now() - interval '45 days';
end $$;
