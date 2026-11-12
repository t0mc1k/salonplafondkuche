-- Version 4.1.02: Öffentlicher Push-Schlüssel (VAPID) wird in der Datenbank gespeichert,
-- damit ein App-Update ihn nicht mehr überschreibt (vorher stand er in js/push.js).
-- Im Supabase SQL Editor ausführen. Voraussetzung: sql/4.1.00_push_tomi.sql.

alter table public.push_config add column if not exists vapid_public_key text;

create or replace function public.push_get_public_key()
returns text language sql stable security definer set search_path = public as $$
  select vapid_public_key from public.push_config where id = 1;
$$;
grant execute on function public.push_get_public_key() to anon, authenticated;

-- Jetzt EINMAL den ÖFFENTLICHEN Schlüssel eintragen (derselbe wie das Secret VAPID_PUBLIC_KEY):
-- update public.push_config set vapid_public_key = 'HIER_DER_OEFFENTLICHE_SCHLUESSEL' where id = 1;
