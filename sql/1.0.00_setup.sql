-- ============================================================
-- Salonplafond KÜCHE – Version 1.0.00 – komplettes Datenbank-Setup
-- Für eine NEUE, leere Supabase-Datenbank.
-- Im Supabase "SQL Editor" einfügen und EINMAL ausführen
-- (bei "Potential issue detected" auf "Run this query" klicken).
-- Danach: sql/1.0.00_first_developer.sql ausführen.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 0) Hilfsfunktion: alle Regeln (Policies) einer Tabelle löschen
--    (nur intern, NICHT von außen aufrufbar)
-- ------------------------------------------------------------
create or replace function public.reset_policies(p_table text)
returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', r.policyname, p_table);
  end loop;
end $$;
revoke all on function public.reset_policies(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 1) Tabellen
-- ------------------------------------------------------------

-- Personal (PINs nur als Hash, nie im Klartext)
create table if not exists public.staff (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  pin_hash         text,
  role             text not null default 'staff' check (role in ('staff','manager','developer')),
  avatar_url       text,
  bio              text not null default '',
  can_edit_recipes boolean not null default false,
  last_used_at     timestamptz,
  created_at       timestamptz not null default now()
);
create unique index if not exists staff_name_lower_uq on public.staff (lower(name));

-- Angemeldete Sitzungen (nur der Hash des Tokens wird gespeichert)
create table if not exists public.staff_sessions (
  token_hash text primary key,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists staff_sessions_staff_idx on public.staff_sessions (staff_id);

-- PIN-Versuche (Sperre nach zu vielen Fehlversuchen)
create table if not exists public.login_attempts (
  id           bigint generated always as identity primary key,
  staff_name   text not null,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_idx on public.login_attempts (lower(staff_name), attempted_at);

-- Login-Protokoll (für Manager/Developer sichtbar)
create table if not exists public.login_history (
  id           uuid primary key default gen_random_uuid(),
  user_name    text not null,
  role         text,
  logged_in_at timestamptz not null default now()
);

-- Gerichte / Rezepte
create table if not exists public.dishes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text,
  season           text,
  plate_type       text,
  method           text,
  cook_time        text,
  garnish          text,
  ingredients_json jsonb not null default '[]'::jsonb,
  cost_price       numeric(10,2),
  selling_price    numeric(10,2),
  allergens        text,
  recipe           text,
  photo_url        text,
  is_featured      boolean not null default false,
  is_vegan         boolean not null default false,
  is_vegetarian    boolean not null default false,
  is_glutenfree    boolean not null default false,
  is_lactosefree   boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);
create index if not exists dishes_season_idx on public.dishes (season);

-- Team-Chat
create table if not exists public.team_chat (
  id          uuid primary key default gen_random_uuid(),
  author_name text not null,
  message     text not null default '' check (char_length(message) <= 4000),
  reply_to_id uuid references public.team_chat(id) on delete set null,
  image_url   text,
  is_pinned   boolean not null default false,
  edited_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists team_chat_created_idx on public.team_chat (created_at);

create table if not exists public.chat_reactions (
  message_id uuid not null references public.team_chat(id) on delete cascade,
  user_name  text not null,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_name, emoji)
);

-- Support-Tickets und Team-News (is_changelog = true)
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  author_email  text not null,
  message       text not null,
  status        text not null default 'pending' check (status in ('pending','resolved')),
  is_changelog  boolean not null default false,
  admin_comment text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) Rechte-Hilfsfunktionen (lesen den Login-Token aus dem Header x-staff-token)
-- ------------------------------------------------------------
create or replace function public.current_staff_id()
returns uuid language plpgsql stable security definer
set search_path = public, extensions as $$
declare h text; t text; v uuid;
begin
  begin h := current_setting('request.headers', true); exception when others then h := null; end;
  if h is null or h = '' then return null; end if;
  t := (h::json) ->> 'x-staff-token';
  if t is null or t = '' then return null; end if;
  select staff_id into v from public.staff_sessions
   where token_hash = encode(digest(t, 'sha256'), 'hex') and expires_at > now();
  return v;
end $$;

create or replace function public.current_staff_name()
returns text language sql stable security definer
set search_path = public, extensions as $$
  select name from public.staff where id = public.current_staff_id();
$$;

create or replace function public.current_staff_role()
returns text language sql stable security definer
set search_path = public, extensions as $$
  select role from public.staff where id = public.current_staff_id();
$$;

create or replace function public.is_staff_admin()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select role in ('manager','developer') from public.staff where id = public.current_staff_id()), false);
$$;

create or replace function public.can_edit_recipes()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select (role in ('manager','developer') or can_edit_recipes)
                     from public.staff where id = public.current_staff_id()), false);
$$;

grant execute on function public.current_staff_id()   to anon, authenticated;
grant execute on function public.current_staff_name() to anon, authenticated;
grant execute on function public.current_staff_role() to anon, authenticated;
grant execute on function public.is_staff_admin()     to anon, authenticated;
grant execute on function public.can_edit_recipes()   to anon, authenticated;

-- ------------------------------------------------------------
-- 3) Funktionen, die die App aufruft (RPC)
-- ------------------------------------------------------------

-- Personal-Liste (Login-Bildschirm, Chat, Verwaltung). Kein PIN-Hash!
create or replace function public.list_staff()
returns table(name text, role text, avatar_url text, bio text,
              can_edit_recipes boolean, last_used_at timestamptz, has_pin boolean)
language sql stable security definer
set search_path = public, extensions as $$
  select s.name, s.role, s.avatar_url, s.bio,
         (s.role in ('manager','developer') or s.can_edit_recipes),
         s.last_used_at, (s.pin_hash is not null)
    from public.staff s
   order by lower(s.name);
$$;

-- Anmeldung per PIN. Gibt bei falschem PIN keine Zeile zurück.
create or replace function public.login_with_pin(p_name text, p_pin text)
returns table(out_token text, out_name text, out_role text, out_avatar text, out_can_edit_recipes boolean)
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
                      (s.role in ('manager','developer') or s.can_edit_recipes);
end $$;

create or replace function public.logout_staff()
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare h text; t text;
begin
  begin h := current_setting('request.headers', true); exception when others then h := null; end;
  t := case when h is null or h = '' then null else (h::json) ->> 'x-staff-token' end;
  if t is not null and t <> '' then
    delete from public.staff_sessions where token_hash = encode(digest(t, 'sha256'), 'hex');
  end if;
end $$;

-- Eigenes Profil: PIN (optional), Beschreibung, Foto (leer = unverändert)
create or replace function public.update_my_profile(p_pin text, p_bio text, p_avatar text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := public.current_staff_id();
begin
  if me is null then raise exception 'Nicht angemeldet'; end if;
  if coalesce(p_pin,'') <> '' and p_pin !~ '^\d{4,6}$' then
    raise exception 'Der PIN muss aus 4 bis 6 Ziffern bestehen.';
  end if;
  update public.staff set
    bio        = left(coalesce(p_bio,''), 140),
    avatar_url = case when coalesce(p_avatar,'') <> '' then p_avatar else avatar_url end,
    pin_hash   = case when coalesce(p_pin,'') <> '' then crypt(p_pin, gen_salt('bf')) else pin_hash end
  where id = me;
end $$;

-- Personal anlegen / ändern (nur Manager und Developer)
create or replace function public.admin_save_staff(p_original text, p_name text, p_pin text,
                                                    p_role text, p_avatar text, p_can_edit boolean)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  caller_role text := public.current_staff_role();
  target public.staff%rowtype;
  v_name text := trim(coalesce(p_name,''));
  v_role text := coalesce(nullif(p_role,''), 'staff');
begin
  if not public.is_staff_admin() then raise exception 'Keine Berechtigung'; end if;
  if v_name = '' then raise exception 'Bitte Name eingeben.'; end if;
  if v_role not in ('staff','manager','developer') then raise exception 'Ungültige Rolle'; end if;
  if v_role = 'developer' and caller_role <> 'developer' then
    raise exception 'Nur ein Developer darf die Rolle Developer vergeben.';
  end if;
  if coalesce(p_pin,'') <> '' and p_pin !~ '^\d{4,6}$' then
    raise exception 'Der PIN muss aus 4 bis 6 Ziffern bestehen.';
  end if;

  if coalesce(p_original,'') = '' then
    if coalesce(p_pin,'') = '' then raise exception 'Bitte einen PIN festlegen.'; end if;
    if exists (select 1 from public.staff where lower(name) = lower(v_name)) then
      raise exception 'Dieser Name existiert bereits.';
    end if;
    insert into public.staff(name, pin_hash, role, avatar_url, can_edit_recipes)
    values (v_name, crypt(p_pin, gen_salt('bf')), v_role, nullif(p_avatar,''),
            (v_role in ('manager','developer') or coalesce(p_can_edit,false)));
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
      can_edit_recipes = (v_role in ('manager','developer') or coalesce(p_can_edit,false)),
      pin_hash   = case when coalesce(p_pin,'') <> '' then crypt(p_pin, gen_salt('bf')) else pin_hash end
    where id = target.id;

    if v_name <> target.name then
      update public.team_chat      set author_name = v_name where author_name = target.name;
      update public.chat_reactions set user_name   = v_name where user_name   = target.name;
    end if;
    if coalesce(p_pin,'') <> '' then
      delete from public.staff_sessions where staff_id = target.id and staff_id <> public.current_staff_id();
    end if;
  end if;
end $$;

-- Personal löschen (Developer-Konten sind geschützt)
create or replace function public.admin_delete_staff(p_name text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare target public.staff%rowtype;
begin
  if not public.is_staff_admin() then raise exception 'Keine Berechtigung'; end if;
  select * into target from public.staff where lower(name) = lower(coalesce(p_name,''));
  if not found then raise exception 'Mitarbeiter nicht gefunden.'; end if;
  if target.role = 'developer' then raise exception 'Developer-Konten können nicht gelöscht werden.'; end if;
  if target.id = public.current_staff_id() then raise exception 'Du kannst dich nicht selbst löschen.'; end if;
  delete from public.staff where id = target.id;
end $$;

-- Login-Protokoll leeren (nur Manager und Developer)
create or replace function public.admin_clear_login_history()
returns integer language plpgsql security definer
set search_path = public as $$
declare n integer;
begin
  if not public.is_staff_admin() then raise exception 'Keine Berechtigung'; end if;
  delete from public.login_history where id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Wer darf was aufrufen: die App benutzt nur den "anon"-Zugang mit Token
revoke all on function public.list_staff()                                  from public;
revoke all on function public.login_with_pin(text, text)                    from public;
revoke all on function public.logout_staff()                                from public;
revoke all on function public.update_my_profile(text, text, text)           from public;
revoke all on function public.admin_save_staff(text, text, text, text, text, boolean) from public;
revoke all on function public.admin_delete_staff(text)                      from public;
revoke all on function public.admin_clear_login_history()                   from public;
grant execute on function public.list_staff()                               to anon, authenticated;
grant execute on function public.login_with_pin(text, text)                 to anon, authenticated;
grant execute on function public.logout_staff()                             to anon, authenticated;
grant execute on function public.update_my_profile(text, text, text)        to anon, authenticated;
grant execute on function public.admin_save_staff(text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_delete_staff(text)                   to anon, authenticated;
grant execute on function public.admin_clear_login_history()                to anon, authenticated;

-- ------------------------------------------------------------
-- 4) Row Level Security (Regeln pro Tabelle)
-- ------------------------------------------------------------

-- Interne Tabellen: kein direkter Zugriff, nur über die Funktionen oben
alter table public.staff          enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.login_attempts enable row level security;
select public.reset_policies('staff');
select public.reset_policies('staff_sessions');
select public.reset_policies('login_attempts');
revoke all on table public.staff, public.staff_sessions, public.login_attempts from anon, authenticated;

-- Login-Protokoll: nur Manager/Developer lesen
alter table public.login_history enable row level security;
select public.reset_policies('login_history');
create policy login_history_read on public.login_history
  for select to public using (public.is_staff_admin());

-- Gerichte: alle angemeldeten Mitarbeiter lesen, Berechtigte ändern
alter table public.dishes enable row level security;
select public.reset_policies('dishes');
create policy dishes_read on public.dishes
  for select to public using (public.current_staff_id() is not null);
create policy dishes_insert on public.dishes
  for insert to public with check (public.can_edit_recipes());
create policy dishes_update on public.dishes
  for update to public using (public.can_edit_recipes()) with check (public.can_edit_recipes());
create policy dishes_delete on public.dishes
  for delete to public using (public.can_edit_recipes());

-- Support-Tickets & Team-News
alter table public.support_tickets enable row level security;
select public.reset_policies('support_tickets');
create policy tickets_read on public.support_tickets
  for select to public using (public.current_staff_id() is not null);
create policy tickets_insert on public.support_tickets
  for insert to public with check (
    public.current_staff_id() is not null
    and ((is_changelog = false and status = 'pending') or public.is_staff_admin())
  );
create policy tickets_update on public.support_tickets
  for update to public using (public.is_staff_admin()) with check (public.is_staff_admin());
create policy tickets_delete on public.support_tickets
  for delete to public using (public.current_staff_role() = 'developer');

-- Team-Chat
-- HINWEIS: Lesen ist offen (using true), damit die Echtzeit-Benachrichtigungen
-- funktionieren (Realtime kennt den Login-Token nicht).
alter table public.team_chat enable row level security;
select public.reset_policies('team_chat');
create policy chat_read on public.team_chat
  for select to public using (true);
create policy chat_insert on public.team_chat
  for insert to public with check (
    public.current_staff_name() is not null
    and lower(author_name) = lower(public.current_staff_name())
  );
create policy chat_update_own on public.team_chat
  for update to public
  using (lower(author_name) = lower(coalesce(public.current_staff_name(), '')))
  with check (lower(author_name) = lower(coalesce(public.current_staff_name(), '')));
create policy chat_update_admin on public.team_chat
  for update to public using (public.is_staff_admin()) with check (public.is_staff_admin());
create policy chat_delete on public.team_chat
  for delete to public using (
    lower(author_name) = lower(coalesce(public.current_staff_name(), '')) or public.is_staff_admin()
  );

alter table public.chat_reactions enable row level security;
select public.reset_policies('chat_reactions');
create policy reactions_read on public.chat_reactions
  for select to public using (true);
create policy reactions_insert on public.chat_reactions
  for insert to public with check (
    public.current_staff_name() is not null
    and lower(user_name) = lower(public.current_staff_name())
  );
create policy reactions_delete on public.chat_reactions
  for delete to public using (lower(user_name) = lower(coalesce(public.current_staff_name(), '')));

-- Schutz im Chat: Autor, Zeit, Antwort-Bezug und Foto bleiben unveränderlich,
-- angepinnt wird nur von Manager/Developer, fremde Texte kann niemand ändern
create or replace function public.team_chat_guard()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not coalesce(public.is_staff_admin(), false) then new.is_pinned := false; end if;
    return new;
  end if;

  new.author_name := old.author_name;
  new.created_at  := old.created_at;
  new.reply_to_id := old.reply_to_id;
  new.image_url   := old.image_url;
  if not coalesce(public.is_staff_admin(), false) then new.is_pinned := old.is_pinned; end if;

  if lower(old.author_name) <> lower(coalesce(public.current_staff_name(), '')) then
    new.message   := old.message;
    new.edited_at := old.edited_at;
  elsif new.message is distinct from old.message then
    new.edited_at := now();
  end if;
  return new;
end $$;

drop trigger if exists team_chat_guard_trg on public.team_chat;
create trigger team_chat_guard_trg
before insert or update on public.team_chat
for each row execute function public.team_chat_guard();

-- ------------------------------------------------------------
-- 5) Echtzeit für den Chat
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_chat') then
    alter publication supabase_realtime add table public.team_chat;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reactions') then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6) Foto-Speicher (Storage): Bucket "kitchen"
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kitchen', 'kitchen', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];

drop policy if exists kitchen_read   on storage.objects;
drop policy if exists kitchen_upload on storage.objects;
create policy kitchen_read on storage.objects
  for select to public using (bucket_id = 'kitchen');
create policy kitchen_upload on storage.objects
  for insert to public with check (bucket_id = 'kitchen');
