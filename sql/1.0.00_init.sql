-- Version 1.0.00 (Küche): Grundlage – Personal, PIN-Login, Rollen, Hilfsfunktionen
-- Im Supabase SQL Editor ausführen (leere Datenbank). Danach folgen die weiteren Dateien in sql/.
-- Rollen: developer, manager, kitchen (Koch), dishwasher (Abwasher).
-- Zusatzrollen (extra_roles): z. B. Tomas = developer + dishwasher.
-- Start-PIN für alle: 1234 (bitte nach dem ersten Login ändern, Profil → PIN).
-- Die Tabellen haben RLS ohne Policies: Zugriff nur über die Funktionen unten (security definer).

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabellen ----------
create table if not exists public.staff (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  pin_hash        text,
  role            text not null default 'kitchen' check (role in ('developer','manager','kitchen','dishwasher')),
  extra_roles     text[] not null default '{}',
  team            text,                         -- AM-Team, PM-Team, Lehrling, Reinigung
  job_title       text,                         -- z. B. Chef, Saucier
  avatar_url      text not null default '',
  bio             text not null default '',
  can_edit_drinks boolean not null default false, -- Name bleibt wegen JS; bedeutet hier: darf Rezepte bearbeiten
  must_change_pin boolean not null default true,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now()
);
create unique index if not exists staff_name_uq on public.staff (lower(name));

create table if not exists public.auth_tokens (
  token       text primary key,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists auth_tokens_staff_idx on public.auth_tokens (staff_id);

create table if not exists public.login_history (
  id           bigserial primary key,
  user_name    text not null,
  role         text,
  logged_in_at timestamptz not null default now()
);

alter table public.staff         enable row level security;
alter table public.auth_tokens   enable row level security;
alter table public.login_history enable row level security;

-- ---------- Hilfsfunktionen ----------
-- Löscht alle Policies einer Tabelle (wird von späteren SQL-Dateien benutzt).
create or replace function public.reset_policies(p_table text)
returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy %I on public.%I', r.policyname, p_table);
  end loop;
end $$;

create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select t.staff_id from public.auth_tokens t
  where t.token = nullif(current_setting('request.headers', true)::json ->> 'x-staff-token', '')
    and t.expires_at > now()
  limit 1
$$;

create or replace function public.current_staff_name()
returns text language sql stable security definer set search_path = public as $$
  select s.name from public.staff s where s.id = public.current_staff_id()
$$;

create or replace function public.current_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select s.role from public.staff s where s.id = public.current_staff_id()
$$;

-- manager oder developer
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_staff_role() in ('manager','developer'), false)
$$;

-- Hauptrolle ODER Zusatzrolle (z. B. 'dishwasher')
create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.role = p_role or p_role = any(s.extra_roles)
                   from public.staff s where s.id = public.current_staff_id()), false)
$$;

-- ---------- Login ----------
create or replace function public.list_staff()
returns table (name text, role text, extra_roles text[], team text, job_title text, avatar_url text,
               bio text, can_edit_drinks boolean, has_pin boolean, last_used_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.name, s.role, s.extra_roles, s.team, s.job_title, s.avatar_url, s.bio,
         s.can_edit_drinks, (s.pin_hash is not null), s.last_used_at
  from public.staff s order by s.name
$$;

create or replace function public.login_with_pin(p_name text, p_pin text)
returns table (out_token text, out_name text, out_role text, out_avatar text,
               out_can_edit_drinks boolean, out_extra_roles text[], out_must_change_pin boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare s public.staff; tok text;
begin
  select * into s from public.staff where lower(name) = lower(btrim(p_name));
  if not found then return; end if;
  if s.locked_until is not null and s.locked_until > now() then
    raise exception 'Zu viele Fehlversuche. Bitte später erneut versuchen.';
  end if;
  if s.pin_hash is null or extensions.crypt(p_pin, s.pin_hash) <> s.pin_hash then
    update public.staff set
      failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' else null end
    where id = s.id;
    return;
  end if;
  update public.staff set failed_attempts = 0, locked_until = null, last_used_at = now() where id = s.id;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  delete from public.auth_tokens where expires_at < now();
  insert into public.auth_tokens (token, staff_id, expires_at) values (tok, s.id, now() + interval '15 hours');
  insert into public.login_history (user_name, role) values (s.name, s.role);
  return query select tok, s.name, s.role, s.avatar_url, s.can_edit_drinks, s.extra_roles, s.must_change_pin;
end $$;

create or replace function public.logout_staff()
returns void language sql security definer set search_path = public as $$
  delete from public.auth_tokens
  where token = nullif(current_setting('request.headers', true)::json ->> 'x-staff-token', '')
$$;

-- ---------- Profil & Verwaltung ----------
create or replace function public.update_my_profile(p_pin text, p_bio text, p_avatar text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := public.current_staff_id();
begin
  if me is null then raise exception 'Nicht angemeldet.'; end if;
  if coalesce(p_pin, '') <> '' and p_pin !~ '^\d{4,6}$' then raise exception 'Der PIN muss aus 4 bis 6 Ziffern bestehen.'; end if;
  update public.staff set
    bio = coalesce(p_bio, bio),
    avatar_url = case when coalesce(p_avatar, '') <> '' then p_avatar else avatar_url end,
    pin_hash = case when coalesce(p_pin, '') <> '' then extensions.crypt(p_pin, extensions.gen_salt('bf')) else pin_hash end,
    must_change_pin = case when coalesce(p_pin, '') <> '' then false else must_change_pin end
  where id = me;
end $$;

create or replace function public.admin_save_staff(
  p_original text, p_name text, p_pin text, p_role text, p_avatar text, p_can_edit boolean,
  p_extra_roles text[] default '{}', p_team text default null, p_job_title text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me_role text := public.current_staff_role(); old public.staff;
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  if p_role not in ('developer','manager','kitchen','dishwasher') then raise exception 'Ungültige Rolle.'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Name fehlt.'; end if;
  if coalesce(p_pin, '') <> '' and p_pin !~ '^\d{4,6}$' then raise exception 'Der PIN muss aus 4 bis 6 Ziffern bestehen.'; end if;
  if coalesce(p_original, '') = '' then
    if me_role <> 'developer' and p_role = 'developer' then raise exception 'Nur Developer dürfen Developer anlegen.'; end if;
    if coalesce(p_pin, '') = '' then raise exception 'PIN fehlt.'; end if;
    insert into public.staff (name, pin_hash, role, extra_roles, team, job_title, avatar_url, can_edit_drinks)
    values (btrim(p_name), extensions.crypt(p_pin, extensions.gen_salt('bf')), p_role, coalesce(p_extra_roles, '{}'),
            p_team, p_job_title, coalesce(p_avatar, ''), coalesce(p_can_edit, false));
  else
    select * into old from public.staff where lower(name) = lower(p_original);
    if not found then raise exception 'Mitarbeiter nicht gefunden.'; end if;
    if me_role <> 'developer' and (old.role = 'developer' or p_role = 'developer') then
      raise exception 'Nur Developer dürfen Developer ändern.';
    end if;
    update public.staff set
      name = btrim(p_name), role = p_role, extra_roles = coalesce(p_extra_roles, '{}'),
      team = p_team, job_title = p_job_title,
      avatar_url = coalesce(p_avatar, avatar_url), can_edit_drinks = coalesce(p_can_edit, false),
      pin_hash = case when coalesce(p_pin, '') <> '' then extensions.crypt(p_pin, extensions.gen_salt('bf')) else pin_hash end,
      must_change_pin = case when coalesce(p_pin, '') <> '' then true else must_change_pin end
    where id = old.id;
  end if;
end $$;

create or replace function public.admin_delete_staff(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare old public.staff;
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  select * into old from public.staff where lower(name) = lower(p_name);
  if not found then return; end if;
  if old.role = 'developer' and public.current_staff_role() <> 'developer' then raise exception 'Nur Developer dürfen Developer löschen.'; end if;
  if old.id = public.current_staff_id() then raise exception 'Du kannst dich nicht selbst löschen.'; end if;
  delete from public.staff where id = old.id;
end $$;

create or replace function public.admin_clear_login_history()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  delete from public.login_history where true;
end $$;

-- Login-Historie lesen (nur Leitung)
drop policy if exists login_history_admin_read on public.login_history;
create policy login_history_admin_read on public.login_history for select using (public.is_admin());

-- ---------- Personal (PIN 1234, muss beim ersten Login geändert werden) ----------
insert into public.staff (name, pin_hash, role, extra_roles, team) values
  ('Alexander Kantner',  extensions.crypt('1234', extensions.gen_salt('bf')), 'manager',    '{}', null),
  ('Matthias Hondl',     extensions.crypt('1234', extensions.gen_salt('bf')), 'manager',    '{}', null),
  ('Chintiana Kampa',    extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'AM-Team'),
  ('Ali Tschangezi',     extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'AM-Team'),
  ('Robin Mühlbacher',   extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'AM-Team'),
  ('Albin Fasching',     extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'AM-Team'),
  ('Jonathan Adler',     extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'Lehrling'),
  ('Emma Klampfl',       extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'Lehrling'),
  ('Raik Nagorny',       extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'PM-Team'),
  ('Tibor Czibulka',     extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'PM-Team'),
  ('Anas Fahdawi',       extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'PM-Team'),
  ('Lisa Kitzmüller',    extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', 'PM-Team'),
  ('Liliia Pomazanova',  extensions.crypt('1234', extensions.gen_salt('bf')), 'kitchen',    '{}', null),
  ('Kumbicak Hünkar',    extensions.crypt('1234', extensions.gen_salt('bf')), 'dishwasher', '{}', 'Reinigung'),
  ('Emmanuel Elumah',    extensions.crypt('1234', extensions.gen_salt('bf')), 'dishwasher', '{}', 'Reinigung'),
  ('Tomas Kardos',       extensions.crypt('1234', extensions.gen_salt('bf')), 'developer',  '{dishwasher}', 'Reinigung')
on conflict ((lower(name))) do nothing;
