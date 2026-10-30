-- ============================================================
-- Salonplafond KÜCHE 1.2.00 – Web-Push für die Schichtübergabe
-- Voraussetzung: 1.0.00_setup.sql und 1.1.00_handovers.sql wurden ausgeführt.
-- Kann gefahrlos mehrfach ausgeführt werden.
--
-- Ablauf: Neue Aufgabe oder neuer Status in kitchen_handovers
--   -> Trigger ruft (über pg_net) die Edge Function "send-push" auf
--   -> Edge Function schickt Push an alle Geräte außer dem Auslöser.
-- Mitteilungen bei GEÖFFNETER App funktionieren auch ohne diese Datei.
-- ============================================================

create extension if not exists pg_net;

-- 1) Geräte, die Push empfangen wollen (je Gerät eine Zeile)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_staff_idx on public.push_subscriptions (staff_id);
alter table public.push_subscriptions enable row level security;
select public.reset_policies('push_subscriptions');
revoke all on table public.push_subscriptions from anon, authenticated;   -- nur über die Funktionen unten

-- 2) Geheime Einstellungen (nicht von der App lesbar)
create table if not exists public.push_config (
  key   text primary key,
  value text not null
);
alter table public.push_config enable row level security;
select public.reset_policies('push_config');
revoke all on table public.push_config from anon, authenticated;

insert into public.push_config (key, value)
values ('edge_url', 'https://rdymkhkowbyslhfnbubk.supabase.co/functions/v1/send-push')
on conflict (key) do nothing;

insert into public.push_config (key, value)
values ('webhook_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- 3) Funktionen, die die App aufruft
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := public.current_staff_id();
begin
  if me is null then raise exception 'Nicht angemeldet'; end if;
  if coalesce(p_endpoint,'') = '' or coalesce(p_p256dh,'') = '' or coalesce(p_auth,'') = '' then
    raise exception 'Ungültige Push-Anmeldung';
  end if;
  insert into public.push_subscriptions (endpoint, staff_id, p256dh, auth, user_agent)
  values (p_endpoint, me, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
    set staff_id = me, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  delete from public.push_subscriptions
   where endpoint = p_endpoint and staff_id = public.current_staff_id();
end $$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;

-- 4) Trigger: ein Aufruf pro Speichervorgang (mehrere Aufgaben = eine Mitteilung)
create or replace function public.kitchen_handovers_push_ins()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_url text; v_secret text; v_items jsonb; v_actor text;
begin
  select value into v_url    from public.push_config where key = 'edge_url';
  select value into v_secret from public.push_config where key = 'webhook_secret';
  if v_url is null or v_secret is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'item_name', item_name, 'station', station, 'author_name', author_name,
           'is_optional', is_optional) order by created_at),
         max(author_name)
    into v_items, v_actor
    from new_rows;
  if v_items is null then return null; end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('kind', 'insert', 'actor', v_actor, 'items', v_items)
  );
  return null;
exception when others then
  return null;     -- Push darf das Speichern nie verhindern
end $$;

create or replace function public.kitchen_handovers_push_upd()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_url text; v_secret text; v_items jsonb;
begin
  select value into v_url    from public.push_config where key = 'edge_url';
  select value into v_secret from public.push_config where key = 'webhook_secret';
  if v_url is null or v_secret is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'item_name', n.item_name, 'station', n.station,
           'status', n.status, 'old_status', o.status))
    into v_items
    from new_rows n join old_rows o on o.id = n.id
   where n.status is distinct from o.status;
  if v_items is null then return null; end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('kind', 'status', 'actor', coalesce(public.current_staff_name(), ''), 'items', v_items)
  );
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists kitchen_handovers_push_ins_trg on public.kitchen_handovers;
create trigger kitchen_handovers_push_ins_trg
after insert on public.kitchen_handovers
referencing new table as new_rows
for each statement execute function public.kitchen_handovers_push_ins();

drop trigger if exists kitchen_handovers_push_upd_trg on public.kitchen_handovers;
create trigger kitchen_handovers_push_upd_trg
after update on public.kitchen_handovers
referencing old table as old_rows new table as new_rows
for each statement execute function public.kitchen_handovers_push_upd();

-- 5) Korrektur: Beim Umbenennen eines Mitarbeiters sollen Chat und Übergabe den neuen Namen zeigen.
--    Die Schutz-Trigger haben das bisher blockiert. Jetzt darf ein Küchenchef/Sous Chef/Developer den Autor-Namen ändern.
create or replace function public.team_chat_guard()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not coalesce(public.is_staff_admin(), false) then new.is_pinned := false; end if;
    return new;
  end if;

  if not coalesce(public.is_staff_admin(), false) then new.author_name := old.author_name; end if;
  new.created_at  := old.created_at;
  new.reply_to_id := old.reply_to_id;
  new.image_url   := old.image_url;
  if not coalesce(public.is_staff_admin(), false) then new.is_pinned := old.is_pinned; end if;

  if lower(old.author_name) <> lower(coalesce(public.current_staff_name(), '')) then
    new.message   := old.message;
    new.edited_at := old.edited_at;
  elsif new.message is distinct from old.message then
    new.edited_at := now();
  end if;
  return new;
end $$;

create or replace function public.kitchen_handovers_guard()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then new.author_name := old.author_name; end if;
  new.created_at := old.created_at;
  new.shift_date := old.shift_date;

  if lower(old.author_name) <> lower(coalesce(public.current_staff_name(), ''))
     and not coalesce(public.is_staff_admin(), false) then
    new.station     := old.station;
    new.item_name   := old.item_name;
    new.is_optional := old.is_optional;
    new.notes       := old.notes;
  end if;
  return new;
end $$;

-- 6) Dein geheimes Webhook-Passwort (für die Edge Function als WEBHOOK_SECRET eintragen):
select value as webhook_secret from public.push_config where key = 'webhook_secret';
