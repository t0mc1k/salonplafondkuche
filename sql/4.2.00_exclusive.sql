-- Version 4.2.00: Exklusive Schichten (Tischtabelle mit Soll / Ist / Tisch-Nr. und Gerichten) – nur Manager/Developer
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Voraussetzungen (bereits vorhanden): public.current_staff_name(), public.is_staff_admin(), public.reset_policies(text).
-- Alles ist nur für Manager/Developer lesbar und änderbar. Für eine spätere Anbindung einer anderen App
-- (z. B. Küche) sind die Daten bewusst in einfachen Tabellen gespeichert.

-- =====================================================================
-- 1) Tabellen
-- =====================================================================
create table if not exists public.exclusive_shifts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Exklusiv' check (length(btrim(title)) between 1 and 80),
  shift_date  date not null default current_date,
  status      text not null default 'open' check (status in ('open', 'closed')),
  -- Gerichte (Spalten): [{ "id": "d1", "name": "Tag", "type": "count" | "note" }]  (Reihenfolge = Reihenfolge der Spalten)
  dishes      jsonb not null default '[]'::jsonb check (jsonb_typeof(dishes) = 'array'),
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists exclusive_shifts_date_idx on public.exclusive_shifts (shift_date desc);

create table if not exists public.exclusive_tables (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.exclusive_shifts (id) on delete cascade,
  table_no    text not null check (length(btrim(table_no)) between 1 and 12),
  soll        integer check (soll is null or (soll >= 0 and soll <= 99)),   -- leer = noch nicht eingetragen
  ist         integer check (ist is null or (ist >= 0 and ist <= 99)),
  cells       jsonb not null default '{}'::jsonb check (jsonb_typeof(cells) = 'object'),   -- { "<dishId>": Zahl oder Text }
  updated_by  text,
  updated_at  timestamptz not null default now()
);
create index if not exists exclusive_tables_shift_idx on public.exclusive_tables (shift_id);

alter table public.exclusive_shifts enable row level security;
alter table public.exclusive_tables enable row level security;
select public.reset_policies('exclusive_shifts');
select public.reset_policies('exclusive_tables');

create policy exclusive_shifts_admin on public.exclusive_shifts
  for all to public
  using (coalesce(public.is_staff_admin(), false))
  with check (coalesce(public.is_staff_admin(), false));
create policy exclusive_tables_admin on public.exclusive_tables
  for all to public
  using (coalesce(public.is_staff_admin(), false))
  with check (coalesce(public.is_staff_admin(), false));

-- =====================================================================
-- 2) Einzelnes Feld speichern (atomar, damit zwei Eingaben nie die Zeile des anderen überschreiben)
--    p_field: 'table_no' | 'soll' | 'ist' | 'c:<dishId>'     p_value: Text; leer = löschen
-- =====================================================================
create or replace function public.exclusive_set_field(p_id uuid, p_field text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); v text := nullif(btrim(coalesce(p_value, '')), ''); n integer;
begin
  if not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur Manager und Developer dürfen die Tabelle bearbeiten.';
  end if;
  if p_field in ('soll', 'ist') then
    if v is null then n := null;
    else
      if v !~ '^\d{1,2}$' then raise exception 'Bitte eine Zahl von 0 bis 99 eingeben.'; end if;
      n := v::integer;
    end if;
    if p_field = 'soll' then update public.exclusive_tables set soll = n, updated_by = me, updated_at = now() where id = p_id;
    else update public.exclusive_tables set ist = n, updated_by = me, updated_at = now() where id = p_id;
    end if;
  elsif p_field = 'table_no' then
    if v is null then raise exception 'Die Tischnummer darf nicht leer sein.'; end if;
    update public.exclusive_tables set table_no = left(v, 12), updated_by = me, updated_at = now() where id = p_id;
  elsif p_field like 'c:%' and length(p_field) between 3 and 40 then
    if v is null then
      update public.exclusive_tables set cells = cells - substr(p_field, 3), updated_by = me, updated_at = now() where id = p_id;
    elsif v ~ '^\d{1,2}$' then
      update public.exclusive_tables set cells = jsonb_set(cells, array[substr(p_field, 3)], to_jsonb(v::integer), true), updated_by = me, updated_at = now() where id = p_id;
    else
      update public.exclusive_tables set cells = jsonb_set(cells, array[substr(p_field, 3)], to_jsonb(left(v, 60)), true), updated_by = me, updated_at = now() where id = p_id;
    end if;
  else
    raise exception 'Unbekanntes Feld.';
  end if;
  if not found then raise exception 'Zeile nicht gefunden.'; end if;
end $$;
