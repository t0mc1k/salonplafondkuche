-- Version 1.0.01 (Küche): Rezepte + Foto-Speicher
-- Im Supabase SQL Editor ausführen (nach 1.0.00_init.sql).
-- Sehen: Manager, Developer, Köche (Abwasher nicht). Bearbeiten: Manager/Developer und Personen mit „darf Rezepte bearbeiten“.
-- „Angelegt von“ / „Zuletzt geändert von“ setzt die Datenbank selbst (nicht fälschbar).

-- Wer darf Rezepte bearbeiten?
create or replace function public.can_edit_recipes()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.role in ('manager','developer') or s.can_edit_drinks
                   from public.staff s where s.id = public.current_staff_id()), false)
$$;

-- Wer darf Rezepte sehen? Alle Angemeldeten außer reinen Abwashern (Hauptrolle dishwasher)
create or replace function public.can_see_recipes()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.role <> 'dishwasher' from public.staff s where s.id = public.current_staff_id()), false)
$$;

create table if not exists public.recipes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null,
  season           text not null default '',
  portions         text not null default '',   -- z. B. „4 Portionen“, „1 GN 1/1“
  method           text not null default '',   -- Garmethode: Braten, Kochen, Sous-vide ...
  prep_time        text not null default '',   -- z. B. „45 Min“
  plating          text not null default '',   -- Anrichten / Garnitur
  ingredients_json jsonb not null default '[]'::jsonb,   -- [{ "name": "...", "amount": "..." }]
  recipe           text not null default '',   -- Zubereitung Schritt für Schritt
  allergens        text not null default '',
  cost_price       numeric(10,2),              -- Wareneinsatz pro Portion
  selling_price    numeric(10,2),
  photo_url        text not null default '',
  photo_urls       jsonb not null default '[]'::jsonb,
  is_featured      boolean not null default false,
  is_vegan         boolean not null default false,
  is_glutenfree    boolean not null default false,
  is_lactosefree   boolean not null default false,
  created_by       text,
  updated_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists recipes_category_idx on public.recipes (category);
create index if not exists recipes_season_idx on public.recipes (season);

-- Name der Person automatisch eintragen
create or replace function public.recipes_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare me text := public.current_staff_name();
begin
  if tg_op = 'INSERT' then
    new.created_by := me;
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := me;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists recipes_stamp_trg on public.recipes;
create trigger recipes_stamp_trg before insert or update on public.recipes
  for each row execute function public.recipes_stamp();

alter table public.recipes enable row level security;
select public.reset_policies('recipes');
create policy recipes_select on public.recipes for select using (public.can_see_recipes());
create policy recipes_insert on public.recipes for insert with check (public.can_edit_recipes());
create policy recipes_update on public.recipes for update using (public.can_edit_recipes()) with check (public.can_edit_recipes());
create policy recipes_delete on public.recipes for delete using (public.can_edit_recipes());

grant select, insert, update, delete on public.recipes to anon, authenticated;

-- ---------- Foto-Speicher (Rezepte, Chat, Profil, Störungen ...) ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists photos_read on storage.objects;
drop policy if exists photos_insert on storage.objects;
create policy photos_read   on storage.objects for select using (bucket_id = 'photos');
create policy photos_insert on storage.objects for insert with check (bucket_id = 'photos');

-- ---------- Korrektur: Team/Position beim Bearbeiten nicht überschreiben ----------
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
      team = coalesce(p_team, team), job_title = coalesce(p_job_title, job_title),
      avatar_url = coalesce(p_avatar, avatar_url), can_edit_drinks = coalesce(p_can_edit, false),
      pin_hash = case when coalesce(p_pin, '') <> '' then extensions.crypt(p_pin, extensions.gen_salt('bf')) else pin_hash end,
      must_change_pin = case when coalesce(p_pin, '') <> '' then true else must_change_pin end
    where id = old.id;
  end if;
end $$;
