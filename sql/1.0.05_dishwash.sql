-- Version 1.0.08 (Küche): Abwasher – Reinigungsaufgaben, Erledigt-Einträge, Monatswertung
-- Im Supabase SQL Editor ausführen (nach 1.0.04_fridge_temps.sql).
--
-- wash_areas : Orte/Aufgaben mit Foto und Rhythmus (täglich / wöchentlich / monatlich). Pflegen: Manager/Developer.
-- wash_logs  : „Erledigt“-Einträge. Name und Zeit setzt die Datenbank. area_id leer = Extra-Eintrag (Freitext).
-- wash_monthly: gespeicherte Monatswertung (Rangliste), wird automatisch nach Monatsende geschrieben.
--
-- Zugriff: Abwasher (Hauptrolle ODER Zusatzrolle dishwasher) sehen und füllen ihren Bereich,
--          Manager/Developer sehen alles und verwalten die Orte. Köche haben KEINEN Zugriff.

create table if not exists public.wash_areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  photo_url   text not null default '',
  frequency   text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.wash_logs (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid references public.wash_areas(id) on delete set null,
  area_name  text not null default '',          -- Kopie des Namens (bleibt lesbar, auch wenn der Ort gelöscht wird)
  extra_text text,                              -- nur bei Extra-Einträgen
  done_by    text not null,
  done_at    timestamptz not null default now(),
  check (area_id is not null or length(btrim(coalesce(extra_text, ''))) > 0)
);
create index if not exists wash_logs_done_at_idx on public.wash_logs (done_at);
create index if not exists wash_logs_area_idx on public.wash_logs (area_id, done_at);
create index if not exists wash_logs_by_idx on public.wash_logs (done_by);

create table if not exists public.wash_monthly (
  month      date not null,                     -- erster Tag des Monats
  staff_name text not null,
  tasks      int  not null default 0,           -- erledigte Aufgaben aus der Liste
  extras     int  not null default 0,           -- Extra-Einträge
  total      int  not null default 0,
  rank       int  not null,
  closed_at  timestamptz not null default now(),
  primary key (month, staff_name)
);

-- Name und Zeit setzt immer die Datenbank (nicht fälschbar)
create or replace function public.wash_logs_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  new.done_by := me;
  new.done_at := now();
  if new.area_id is not null then
    select a.name into new.area_name from public.wash_areas a where a.id = new.area_id;
    new.extra_text := null;
  else
    new.area_name := '';
    new.extra_text := left(btrim(new.extra_text), 120);
  end if;
  return new;
end $$;
drop trigger if exists wash_logs_stamp_trg on public.wash_logs;
create trigger wash_logs_stamp_trg before insert on public.wash_logs
  for each row execute function public.wash_logs_stamp();

create or replace function public.wash_areas_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by := public.current_staff_name(); end if;
  return new;
end $$;
drop trigger if exists wash_areas_stamp_trg on public.wash_areas;
create trigger wash_areas_stamp_trg before insert on public.wash_areas
  for each row execute function public.wash_areas_stamp();

-- Monatswertung speichern: für jeden abgeschlossenen Monat einmal (wird beim Öffnen des Bereichs aufgerufen)
create or replace function public.wash_close_due_months()
returns void language plpgsql security definer set search_path = public as $$
declare
  m date;
  this_month date := date_trunc('month', now() at time zone 'Europe/Vienna')::date;
begin
  if public.current_staff_id() is null then return; end if;
  select date_trunc('month', min(done_at at time zone 'Europe/Vienna'))::date into m from public.wash_logs;
  if m is null then return; end if;
  while m < this_month loop
    if not exists (select 1 from public.wash_monthly w where w.month = m) then
      insert into public.wash_monthly (month, staff_name, tasks, extras, total, rank)
      select m, x.name, x.tasks, x.extras, x.tasks + x.extras,
             rank() over (order by x.tasks + x.extras desc, x.tasks desc)
      from (
        select s.name,
               coalesce(count(l.id) filter (where l.area_id is not null), 0)::int as tasks,
               coalesce(count(l.id) filter (where l.area_id is null), 0)::int as extras
        from public.staff s
        left join public.wash_logs l
          on l.done_by = s.name
         and (l.done_at at time zone 'Europe/Vienna') >= m::timestamp
         and (l.done_at at time zone 'Europe/Vienna') <  (m + interval '1 month')::timestamp
        where s.role = 'dishwasher' or 'dishwasher' = any(s.extra_roles)
        group by s.name
      ) x;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
end $$;

alter table public.wash_areas   enable row level security;
alter table public.wash_logs    enable row level security;
alter table public.wash_monthly enable row level security;
select public.reset_policies('wash_areas');
select public.reset_policies('wash_logs');
select public.reset_policies('wash_monthly');

-- Orte: Abwasher und Leitung lesen, nur Leitung ändert
create policy wash_areas_select on public.wash_areas for select using (public.is_admin() or public.has_role('dishwasher'));
create policy wash_areas_insert on public.wash_areas for insert with check (public.is_admin());
create policy wash_areas_update on public.wash_areas for update using (public.is_admin()) with check (public.is_admin());
create policy wash_areas_delete on public.wash_areas for delete using (public.is_admin());

-- Einträge: Abwasher und Leitung lesen/anlegen; löschen: Leitung immer, Abwasher nur eigene in der ersten Stunde
create policy wash_logs_select on public.wash_logs for select using (public.is_admin() or public.has_role('dishwasher'));
create policy wash_logs_insert on public.wash_logs for insert with check (public.is_admin() or public.has_role('dishwasher'));
create policy wash_logs_delete on public.wash_logs for delete
  using (public.is_admin() or (done_by = public.current_staff_name() and done_at > now() - interval '1 hour'));

-- Monatswertung: nur Leitung
create policy wash_monthly_select on public.wash_monthly for select using (public.is_admin());

grant select, insert, update, delete on public.wash_areas, public.wash_logs to anon, authenticated;
grant select on public.wash_monthly to anon, authenticated;
