-- Version 4.1.06: Tagesangebot (Tageskuchen, Tagessuppe, optional Tagesgericht) mit Allergenen A–R
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Voraussetzungen (bereits vorhanden): public.current_staff_name(), public.is_staff_admin(), public.reset_policies(text).

create table if not exists public.daily_specials (
  id           uuid primary key default gen_random_uuid(),
  -- cake = Tageskuchen, soup = Tagessuppe, dish = Tagesgericht (in der App derzeit nur Kuchen und Suppe angeboten)
  kind         text not null check (kind in ('cake', 'soup', 'dish')),
  name         text not null check (length(btrim(name)) between 1 and 120),
  description  text,
  price        numeric(8, 2) check (price is null or (price >= 0 and price < 1000)),
  allergens    text[] not null default '{}',
  valid_from   date not null default current_date,
  valid_to     date not null default current_date,
  source       text not null default 'manual' check (source in ('manual', 'scan')),   -- scan = per Foto erkannt und vom Manager geprüft
  created_by   text,
  created_at   timestamptz not null default now(),
  constraint daily_specials_dates_valid check (valid_to >= valid_from),
  constraint daily_specials_allergens_valid
    check (allergens <@ array['A','B','C','D','E','F','G','H','L','M','N','O','P','R']::text[])
);
create index if not exists daily_specials_valid_idx on public.daily_specials (valid_from, valid_to);

alter table public.daily_specials enable row level security;
select public.reset_policies('daily_specials');

-- Lesen: alle angemeldeten Mitarbeiter. Schreiben: nur Manager und Developer.
create policy daily_specials_read on public.daily_specials
  for select to public using (public.current_staff_name() is not null);
create policy daily_specials_admin on public.daily_specials
  for all to public
  using (coalesce(public.is_staff_admin(), false))
  with check (coalesce(public.is_staff_admin(), false));
