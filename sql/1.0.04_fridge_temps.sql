-- Version 1.0.06 (Küche): Temperaturlisten der Kühlschränke (Manager/Developer)
-- Im Supabase SQL Editor ausführen (nach 1.0.03_exclusive_days.sql).
-- fridges: Kühlgeräte mit Soll-Bereich (temp_min / temp_max, leer = keine Grenze). Vorlage: Temperaturlisten.xlsx
-- fridge_temps: ein Messwert pro Gerät und Tag (einmal täglich). Wer und wann, setzt die Datenbank selbst.
-- Zugriff: nur Manager und Developer.

create table if not exists public.fridges (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  temp_min   numeric(5,1),               -- z. B. 1.0  (leer = keine Untergrenze)
  temp_max   numeric(5,1),               -- z. B. 3.0  (TK: -18)
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists fridges_name_uq on public.fridges (lower(name));

create table if not exists public.fridge_temps (
  id          uuid primary key default gen_random_uuid(),
  fridge_id   uuid not null references public.fridges(id) on delete cascade,
  day         date not null,
  temp        numeric(5,1) not null check (temp between -60 and 60),
  recorded_by text,
  recorded_at timestamptz not null default now(),
  unique (fridge_id, day)
);
create index if not exists fridge_temps_day_idx on public.fridge_temps (day);

create or replace function public.fridge_temps_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.recorded_by := public.current_staff_name();
  new.recorded_at := now();
  return new;
end $$;
drop trigger if exists fridge_temps_stamp_trg on public.fridge_temps;
create trigger fridge_temps_stamp_trg before insert or update on public.fridge_temps
  for each row execute function public.fridge_temps_stamp();

alter table public.fridges      enable row level security;
alter table public.fridge_temps enable row level security;
select public.reset_policies('fridges');
select public.reset_policies('fridge_temps');

create policy fridges_all      on public.fridges      for all using (public.is_admin()) with check (public.is_admin());
create policy fridge_temps_all on public.fridge_temps for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.fridges, public.fridge_temps to anon, authenticated;

-- Kühlgeräte aus der Vorlage Temperaturlisten.xlsx
insert into public.fridges (name, temp_min, temp_max, sort_order) values
  ('TK',          null, -18, 1),
  ('Fleisch KH',  1,    3,   2),
  ('2. KH',       2,    4,   3),
  ('Gemüse KH',   2,    4,   4),
  ('Pati Oben',   2,    4,   5),
  ('Pati Unten',  2,    4,   6),
  ('Pati TK',     null, -18, 7),
  ('Gardemange',  2,    4,   8),
  ('Saucier',     1,    3,   9),
  ('Entre',       2,    4,   10),
  ('Entre TK',    1,    4,   11)
on conflict ((lower(name))) do nothing;
