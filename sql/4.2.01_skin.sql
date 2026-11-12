-- Version 4.2.01: Stil „NeXuS Glass“ pro Person (gilt auf allen Geräten dieser Person)
-- Im Supabase SQL Editor ausführen. Ohne dieses SQL gilt der Stil nur pro Person auf dem jeweiligen Gerät.
-- Voraussetzung: SQL 4.0.02 (staff_prefs, current_staff_name).

alter table public.staff_prefs add column if not exists skin text not null default 'classic' check (skin in ('classic', 'glass'));

create or replace function public.get_my_skin()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select skin from public.staff_prefs where staff_name = lower(public.current_staff_name())), 'classic');
$$;

create or replace function public.set_my_skin(p_skin text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_skin not in ('classic', 'glass') then raise exception 'Ungültiger Stil.'; end if;
  insert into public.staff_prefs (staff_name, skin) values (lower(me), p_skin)
  on conflict (staff_name) do update set skin = excluded.skin, updated_at = now();
end $$;

grant execute on function public.get_my_skin() to anon, authenticated;
grant execute on function public.set_my_skin(text) to anon, authenticated;
