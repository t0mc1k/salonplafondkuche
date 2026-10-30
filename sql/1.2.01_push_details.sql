-- ============================================================
-- Salonplafond KÜCHE 1.2.01 – Mitteilungen mit Absender und Text, auch für den Chat
-- Voraussetzung: sql/1.2.00_push.sql wurde ausgeführt.
-- Danach die Edge Function send-push neu bereitstellen (Datei hat sich geändert).
-- Kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================

-- 1) Übergabe: Notizen mitschicken, damit die Mitteilung jede Aufgabe samt Notiz zeigen kann
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
           'is_optional', is_optional, 'notes', notes) order by created_at),
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
  return null;
end $$;

-- 2) Chat: neue Nachricht -> Mitteilung mit Absender und Text
create or replace function public.team_chat_push_ins()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_url text; v_secret text; v_actor text; v_msg text; v_img boolean;
begin
  select value into v_url    from public.push_config where key = 'edge_url';
  select value into v_secret from public.push_config where key = 'webhook_secret';
  if v_url is null or v_secret is null then return null; end if;

  select author_name, message, (image_url is not null and image_url <> '')
    into v_actor, v_msg, v_img
    from new_rows order by created_at desc limit 1;
  if v_actor is null then return null; end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('kind', 'chat', 'actor', v_actor,
                                  'message', left(coalesce(v_msg, ''), 300), 'has_image', coalesce(v_img, false))
  );
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists team_chat_push_ins_trg on public.team_chat;
create trigger team_chat_push_ins_trg
after insert on public.team_chat
referencing new table as new_rows
for each statement execute function public.team_chat_push_ins();
