-- Version 4.1.05: Urlaub beantragen & Krankmeldung (Kellner), Entscheidung durch Manager/Developer
-- Im Supabase SQL Editor ausführen, BEVOR die neue App-Version hochgeladen wird.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
--
-- Voraussetzungen (bereits vorhanden): public.current_staff_name(), public.is_staff_admin(),
-- public.reset_policies(text), public.push_enqueue(...) (SQL 3.1.02 / 4.1.00).

-- =====================================================================
-- 1) Tabelle
--    kind:   vacation = Urlaubsantrag, sick = Krankmeldung
--    status: pending  = wartet (Urlaub: auf Entscheidung, Krank: auf Kenntnisnahme)
--            approved = Urlaub genehmigt, rejected = Urlaub abgelehnt,
--            noted    = Krankmeldung zur Kenntnis genommen, cancelled = zurückgezogen
-- =====================================================================
create table if not exists public.absence_requests (
  id            uuid primary key default gen_random_uuid(),
  staff_name    text not null,
  kind          text not null check (kind in ('vacation', 'sick')),
  date_from     date not null,
  date_to       date not null,
  note          text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'noted', 'cancelled')),
  manager_note  text,
  decided_by    text,
  decided_at    timestamptz,
  plan_applied  boolean not null default false,   -- U/K wurde in den Arbeitsplan eingetragen
  created_at    timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists absence_requests_status_idx on public.absence_requests (status, date_from);
create index if not exists absence_requests_staff_idx on public.absence_requests (lower(staff_name));

alter table public.absence_requests enable row level security;
select public.reset_policies('absence_requests');

-- Lesen: Manager/Developer alles, alle anderen nur die eigenen Einträge.
create policy abs_read on public.absence_requests
  for select to public
  using (coalesce(public.is_staff_admin(), false)
         or lower(staff_name) = lower(coalesce(public.current_staff_name(), '')));

-- Löschen (Verlauf aufräumen): nur Manager/Developer. Anlegen/Ändern laufen ausschließlich über die Funktionen unten.
create policy abs_delete_admin on public.absence_requests
  for delete to public
  using (coalesce(public.is_staff_admin(), false));

-- =====================================================================
-- 2) Funktionen
-- =====================================================================

-- Neuer Antrag / neue Krankmeldung (für die angemeldete Person)
create or replace function public.create_absence_request(p_kind text, p_from date, p_to date, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); new_id uuid;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if p_kind not in ('vacation', 'sick') then raise exception 'Ungültige Art.'; end if;
  if p_from is null or p_to is null then raise exception 'Bitte Datum angeben.'; end if;
  if p_to < p_from then raise exception 'Das Ende liegt vor dem Beginn.'; end if;
  if p_to - p_from > 59 then raise exception 'Der Zeitraum darf höchstens 60 Tage umfassen.'; end if;
  if p_kind = 'vacation' and p_from < current_date then
    raise exception 'Urlaub kann nur für heute oder die Zukunft beantragt werden.';
  end if;
  if p_kind = 'sick' and p_from < current_date - 7 then
    raise exception 'Krankmeldungen können höchstens 7 Tage rückwirkend gemeldet werden. Bitte beim Manager melden.';
  end if;
  if exists (select 1 from public.absence_requests
             where lower(staff_name) = lower(me) and kind = p_kind
               and status in ('pending', 'approved', 'noted')
               and date_from <= p_to and date_to >= p_from) then
    raise exception 'Für diesen Zeitraum gibt es schon eine Meldung.';
  end if;
  insert into public.absence_requests (staff_name, kind, date_from, date_to, note)
  values (me, p_kind, p_from, p_to, nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  returning id into new_id;
  return new_id;
end $$;

-- Zurückziehen (eigene offene Meldung oder durch Manager)
create or replace function public.cancel_absence_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); r public.absence_requests%rowtype;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  select * into r from public.absence_requests where id = p_id for update;
  if not found then raise exception 'Meldung nicht gefunden.'; end if;
  if lower(r.staff_name) <> lower(me) and not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur die meldende Person kann zurückziehen.';
  end if;
  if r.status <> 'pending' then raise exception 'Schon entschieden, kann nicht mehr zurückgezogen werden.'; end if;
  update public.absence_requests set status = 'cancelled' where id = p_id;
end $$;

-- Manager entscheidet: Urlaub genehmigen/ablehnen, Krankmeldung zur Kenntnis nehmen (p_approve = true)
create or replace function public.decide_absence_request(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); r public.absence_requests%rowtype;
begin
  if not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur Manager und Developer dürfen entscheiden.';
  end if;
  select * into r from public.absence_requests where id = p_id for update;
  if not found then raise exception 'Meldung nicht gefunden.'; end if;
  if r.status <> 'pending' then raise exception 'Diese Meldung wartet nicht auf eine Entscheidung.'; end if;
  if r.kind = 'sick' and not p_approve then
    raise exception 'Krankmeldungen werden nur zur Kenntnis genommen.';
  end if;
  update public.absence_requests
     set status = case when r.kind = 'sick' then 'noted' when p_approve then 'approved' else 'rejected' end,
         manager_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
         decided_by = me, decided_at = now()
   where id = p_id;
end $$;

-- Manager hat U/K in den Arbeitsplan eingetragen (die App schreibt den Plan selbst; hier nur die Markierung)
create or replace function public.absence_set_applied(p_id uuid, p_applied boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff_admin(), false) then
    raise exception 'Nur Manager und Developer dürfen das.';
  end if;
  update public.absence_requests set plan_applied = coalesce(p_applied, true) where id = p_id;
end $$;

-- =====================================================================
-- 3) Push-Benachrichtigungen (Kategorien: mgr_absence = an Manager, absence = Entscheidung an die Person)
-- =====================================================================
create or replace function public.push_on_absence()
returns trigger language plpgsql security definer set search_path = public as $$
declare d text; tde text; ten text;
begin
  begin
    d := to_char(new.date_from, 'DD.MM.YYYY') || case when new.date_to <> new.date_from then ' – ' || to_char(new.date_to, 'DD.MM.YYYY') else '' end;
    if tg_op = 'INSERT' then
      tde := case when new.kind = 'sick' then '🤒 Krankmeldung: ' else '🏖️ Urlaubsantrag: ' end || new.staff_name;
      ten := case when new.kind = 'sick' then '🤒 Sick report: ' else '🏖️ Vacation request: ' end || new.staff_name;
      perform public.push_enqueue('admins', null, new.staff_name, 'mgr_absence',
        jsonb_build_object(
          'de', jsonb_build_object('title', tde, 'body', d || case when coalesce(new.note, '') <> '' then ' · ' || public.push_excerpt(new.note) else '' end),
          'en', jsonb_build_object('title', ten, 'body', d || case when coalesce(new.note, '') <> '' then ' · ' || public.push_excerpt(new.note) else '' end)),
        'absence', 'absence');
    elsif new.status is distinct from old.status and new.status in ('approved', 'rejected', 'noted') then
      tde := case new.status when 'approved' then '✅ Urlaub genehmigt' when 'rejected' then '❌ Urlaub abgelehnt' else '👍 Krankmeldung erhalten' end;
      ten := case new.status when 'approved' then '✅ Vacation approved' when 'rejected' then '❌ Vacation rejected' else '👍 Sick report received' end;
      perform public.push_enqueue('user', new.staff_name, null, 'absence',
        jsonb_build_object(
          'de', jsonb_build_object('title', tde, 'body', d || case when coalesce(new.manager_note, '') <> '' then ' · ' || public.push_excerpt(new.manager_note) else '' end),
          'en', jsonb_build_object('title', ten, 'body', d || case when coalesce(new.manager_note, '') <> '' then ' · ' || public.push_excerpt(new.manager_note) else '' end)),
        'absence', 'absence');
    end if;
  exception when others then null;   -- eine Benachrichtigung darf nie das Speichern verhindern
  end;
  return new;
end $$;

drop trigger if exists push_trg_absence on public.absence_requests;
create trigger push_trg_absence after insert or update on public.absence_requests
  for each row execute function public.push_on_absence();

-- Neue Push-Kategorien in den persönlichen Einstellungen erlauben (alte Liste + absence, mgr_absence)
create or replace function public.push_set_prefs(p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name(); k text;
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if jsonb_typeof(p_prefs) <> 'object' then raise exception 'Ungültige Einstellungen.'; end if;
  for k in select jsonb_object_keys(p_prefs) loop
    if k not in ('chat', 'mention', 'plan', 'swap', 'news', 'mgr_swap', 'fault', 'fault_urgent', 'ticket', 'absence', 'mgr_absence') then
      raise exception 'Unbekannte Kategorie: %', k;
    end if;
    if jsonb_typeof(p_prefs -> k) <> 'boolean' then raise exception 'Ungültiger Wert für %', k; end if;
  end loop;
  insert into public.push_prefs (staff_name, prefs) values (lower(me), p_prefs)
  on conflict (staff_name) do update set prefs = excluded.prefs, updated_at = now();
end $$;
