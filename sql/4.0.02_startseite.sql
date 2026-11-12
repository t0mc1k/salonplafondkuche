-- Version 4.0.02: Startseite nach dem Login (Dashboard oder Getränke), gilt auf allen Geräten
-- Im Supabase SQL Editor ausführen. Ohne dieses SQL funktioniert die Einstellung trotzdem,
-- gilt dann aber nur auf dem jeweiligen Gerät.
-- Voraussetzung: public.current_staff_name() und public.reset_policies(text) existieren (SQL 3.1.02).

create table if not exists public.staff_prefs (
  staff_name  text primary key,                       -- immer klein geschrieben
  start_page  text not null default 'dashboard' check (start_page in ('dashboard', 'drinks')),
  updated_at  timestamptz not null default now()
);
alter table public.staff_prefs enable row level security;
select public.reset_policies('staff_prefs');          -- keine Policies: nur über die Funktionen unten

create or replace function public.get_my_start_page()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select start_page from public.staff_prefs where staff_name = lower(public.current_staff_name())),
    'dashboard');
$$;

create or replace function public.set_my_start_page(p_page text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_page not in ('dashboard', 'drinks') then raise exception 'Ungültige Startseite.'; end if;
  insert into public.staff_prefs (staff_name, start_page) values (lower(me), p_page)
  on conflict (staff_name) do update set start_page = excluded.start_page, updated_at = now();
end $$;

grant execute on function public.get_my_start_page() to anon, authenticated;
grant execute on function public.set_my_start_page(text) to anon, authenticated;
