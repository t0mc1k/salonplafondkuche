-- ============================================================
-- Salonplafond KÜCHE 1.1.01 – Rolle "Sous Chef" und Funktionen der Köche
-- Voraussetzung: sql/1.0.00_setup.sql wurde schon ausgeführt.
-- Kann gefahrlos mehrfach ausgeführt werden. Bestehende Daten bleiben erhalten.
--
-- Rollen (bestimmen die Rechte):
--   staff     = Koch
--   manager   = Küchenchef
--   souschef  = Sous Chef (gleiche Rechte wie der Küchenchef)
--   developer = Developer
-- Funktion (nur Anzeige bei Köchen): z. B. Saucier, Entre, Lehrling ...
-- ============================================================

-- 1) Neue Spalte für die Funktion
alter table public.staff add column if not exists job_title text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_job_title_len_chk') then
    alter table public.staff add constraint staff_job_title_len_chk
      check (job_title is null or char_length(job_title) <= 40);
  end if;
end $$;

-- 2) Rolle "souschef" erlauben (alte Rollen-Regel ersetzen)
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c
     where c.conrelid = 'public.staff'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.staff drop constraint %I', r.conname);
  end loop;
  alter table public.staff add constraint staff_role_check
    check (role in ('staff','manager','souschef','developer'));
end $$;

-- 3) Rechte-Funktionen: Küchenchef, Sous Chef und Developer sind "Admins"
create or replace function public.is_staff_admin()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select role in ('manager','souschef','developer')
                     from public.staff where id = public.current_staff_id()), false);
$$;

create or replace function public.can_edit_recipes()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select (role in ('manager','souschef','developer') or can_edit_recipes)
                     from public.staff where id = public.current_staff_id()), false);
$$;

grant execute on function public.is_staff_admin()   to anon, authenticated;
grant execute on function public.can_edit_recipes() to anon, authenticated;

-- 4) Funktionen, deren Rückgabe/Parameter sich ändern, zuerst entfernen
drop function if exists public.list_staff();
drop function if exists public.login_with_pin(text, text);
drop function if exists public.admin_save_staff(text, text, text, text, text, boolean);

-- Personal-Liste (jetzt mit Funktion)
create function public.list_staff()
returns table(name text, role text, avatar_url text, bio text,
              can_edit_recipes boolean, last_used_at timestamptz, has_pin boolean, job_title text)
language sql stable security definer
set search_path = public, extensions as $$
  select s.name, s.role, s.avatar_url, s.bio,
         (s.role in ('manager','souschef','developer') or s.can_edit_recipes),
         s.last_used_at, (s.pin_hash is not null), s.job_title
    from public.staff s
   order by lower(s.name);
$$;

-- Anmeldung per PIN (gibt jetzt auch die Funktion zurück)
create function public.login_with_pin(p_name text, p_pin text)
returns table(out_token text, out_name text, out_role text, out_avatar text,
              out_can_edit_recipes boolean, out_job_title text)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  s public.staff%rowtype;
  v_token text;
  fails int;
begin
  select count(*) into fails from public.login_attempts
   where lower(staff_name) = lower(trim(coalesce(p_name,''))) and success = false
     and attempted_at > now() - interval '10 minutes';
  if fails >= 5 then
    raise exception 'Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.';
  end if;

  select * into s from public.staff where lower(name) = lower(trim(coalesce(p_name,'')));
  if not found or s.pin_hash is null or crypt(coalesce(p_pin,''), s.pin_hash) <> s.pin_hash then
    insert into public.login_attempts(staff_name, success) values (coalesce(p_name,''), false);
    return;
  end if;

  delete from public.login_attempts where lower(staff_name) = lower(s.name) or attempted_at < now() - interval '1 day';
  delete from public.staff_sessions where expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.staff_sessions(token_hash, staff_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), s.id, now() + interval '15 hours');

  update public.staff set last_used_at = now() where id = s.id;
  insert into public.login_history(user_name, role) values (s.name, s.role);

  return query select v_token, s.name, s.role, s.avatar_url,
                      (s.role in ('manager','souschef','developer') or s.can_edit_recipes),
                      s.job_title;
end $$;

-- Personal anlegen / ändern (nur Küchenchef, Sous Chef, Developer) – jetzt mit Funktion
create function public.admin_save_staff(p_original text, p_name text, p_pin text,
                                        p_role text, p_avatar text, p_can_edit boolean,
                                        p_job_title text default '')
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  caller_role text := public.current_staff_role();
  target public.staff%rowtype;
  v_name text := trim(coalesce(p_name,''));
  v_role text := coalesce(nullif(p_role,''), 'staff');
  v_job  text;
begin
  if not public.is_staff_admin() then raise exception 'Keine Berechtigung'; end if;
  if v_name = '' then raise exception 'Bitte Name eingeben.'; end if;
  if v_role not in ('staff','manager','souschef','developer') then raise exception 'Ungültige Rolle'; end if;
  if v_role = 'developer' and caller_role <> 'developer' then
    raise exception 'Nur ein Developer darf die Rolle Developer vergeben.';
  end if;
  if coalesce(p_pin,'') <> '' and p_pin !~ '^\d{4,6}$' then
    raise exception 'Der PIN muss aus 4 bis 6 Ziffern bestehen.';
  end if;

  -- Funktion gibt es nur für Köche
  v_job := case when v_role = 'staff' then nullif(left(trim(coalesce(p_job_title,'')), 40), '') else null end;

  if coalesce(p_original,'') = '' then
    if coalesce(p_pin,'') = '' then raise exception 'Bitte einen PIN festlegen.'; end if;
    if exists (select 1 from public.staff where lower(name) = lower(v_name)) then
      raise exception 'Dieser Name existiert bereits.';
    end if;
    insert into public.staff(name, pin_hash, role, avatar_url, can_edit_recipes, job_title)
    values (v_name, crypt(p_pin, gen_salt('bf')), v_role, nullif(p_avatar,''),
            (v_role in ('manager','souschef','developer') or coalesce(p_can_edit,false)), v_job);
  else
    select * into target from public.staff where lower(name) = lower(p_original);
    if not found then raise exception 'Mitarbeiter nicht gefunden.'; end if;
    if target.role = 'developer' and caller_role <> 'developer' then
      raise exception 'Developer-Konten darf nur ein Developer ändern.';
    end if;
    if lower(v_name) <> lower(target.name)
       and exists (select 1 from public.staff where lower(name) = lower(v_name)) then
      raise exception 'Dieser Name existiert bereits.';
    end if;

    update public.staff set
      name       = v_name,
      role       = v_role,
      avatar_url = nullif(p_avatar,''),
      can_edit_recipes = (v_role in ('manager','souschef','developer') or coalesce(p_can_edit,false)),
      job_title  = v_job,
      pin_hash   = case when coalesce(p_pin,'') <> '' then crypt(p_pin, gen_salt('bf')) else pin_hash end
    where id = target.id;

    if v_name <> target.name then
      update public.team_chat      set author_name = v_name where author_name = target.name;
      update public.chat_reactions set user_name   = v_name where user_name   = target.name;
      if to_regclass('public.kitchen_handovers') is not null then
        update public.kitchen_handovers set author_name = v_name where author_name = target.name;
      end if;
    end if;
    if coalesce(p_pin,'') <> '' then
      delete from public.staff_sessions where staff_id = target.id and staff_id <> public.current_staff_id();
    end if;
  end if;
end $$;

-- 5) Aufruf-Rechte
revoke all on function public.list_staff()                                            from public;
revoke all on function public.login_with_pin(text, text)                              from public;
revoke all on function public.admin_save_staff(text, text, text, text, text, boolean, text) from public;
grant execute on function public.list_staff()                                         to anon, authenticated;
grant execute on function public.login_with_pin(text, text)                           to anon, authenticated;
grant execute on function public.admin_save_staff(text, text, text, text, text, boolean, text) to anon, authenticated;

-- 6) Bestehende Konten mit Rolle "manager" bleiben Küchenchef. Wer stattdessen
--    Sous Chef sein soll, änderst du in der App unter "Personal & PINs".
