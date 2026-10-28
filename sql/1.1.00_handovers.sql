-- ============================================================
-- Salonplafond KÜCHE 1.1.00 – Schichtübergabe (Tabelle kitchen_handovers)
-- Voraussetzung: sql/1.0.00_setup.sql wurde schon ausgeführt.
-- Kann gefahrlos mehrfach ausgeführt werden. Bestehende Daten bleiben erhalten.
-- ============================================================

-- Tabelle (wird nur angelegt, falls sie noch nicht existiert)
create table if not exists public.kitchen_handovers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  shift_date  date not null default current_date,
  author_name text not null,
  station     text not null,
  item_name   text not null,
  status      text not null default 'open',
  is_optional boolean not null default false,
  notes       text
);

-- Sinnvolle Standardwerte auch bei einer bereits bestehenden Tabelle
alter table public.kitchen_handovers alter column status set default 'open';
alter table public.kitchen_handovers alter column is_optional set default false;

-- Nur diese drei Stati sind erlaubt (gilt für neue und geänderte Einträge)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kitchen_handovers_status_chk') then
    alter table public.kitchen_handovers
      add constraint kitchen_handovers_status_chk
      check (status in ('open','in_progress','done')) not valid;
  end if;
end $$;

create index if not exists kitchen_handovers_status_date_idx
  on public.kitchen_handovers (status, shift_date);

-- ------------------------------------------------------------
-- Rechte (Row Level Security): gleiches Login-System wie der Rest der App
-- ------------------------------------------------------------
alter table public.kitchen_handovers enable row level security;
select public.reset_policies('kitchen_handovers');

-- Lesen: alle angemeldeten Mitarbeiter
create policy handovers_read on public.kitchen_handovers
  for select to public using (public.current_staff_id() is not null);

-- Anlegen: nur unter dem eigenen Namen
create policy handovers_insert on public.kitchen_handovers
  for insert to public with check (
    public.current_staff_name() is not null
    and lower(author_name) = lower(public.current_staff_name())
  );

-- Ändern: alle angemeldeten Mitarbeiter (Status abhaken); was geändert werden
-- darf, regelt der Schutz-Trigger unten
create policy handovers_update on public.kitchen_handovers
  for update to public
  using (public.current_staff_id() is not null)
  with check (public.current_staff_id() is not null);

-- Löschen: Autor oder Manager/Developer
create policy handovers_delete on public.kitchen_handovers
  for delete to public using (
    lower(author_name) = lower(coalesce(public.current_staff_name(), ''))
    or public.is_staff_admin()
  );

-- Schutz: Autor und Datum sind unveränderlich. Fremde Einträge dürfen
-- andere nur abhaken (Status), nicht umschreiben.
create or replace function public.kitchen_handovers_guard()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  new.author_name := old.author_name;
  new.created_at  := old.created_at;
  new.shift_date  := old.shift_date;

  if lower(old.author_name) <> lower(coalesce(public.current_staff_name(), ''))
     and not coalesce(public.is_staff_admin(), false) then
    new.station     := old.station;
    new.item_name   := old.item_name;
    new.is_optional := old.is_optional;
    new.notes       := old.notes;
  end if;
  return new;
end $$;

drop trigger if exists kitchen_handovers_guard_trg on public.kitchen_handovers;
create trigger kitchen_handovers_guard_trg
before update on public.kitchen_handovers
for each row execute function public.kitchen_handovers_guard();
