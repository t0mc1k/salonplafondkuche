-- Salonplafond KÜCHE 1.0.00 – ersten Zugang (Developer) anlegen
-- Nach 1.0.00_setup.sql ausführen. Ohne diesen Schritt kann sich niemand anmelden.
--
-- WICHTIG: Unten bei v_pin einen eigenen PIN aus 4 bis 6 Ziffern eintragen.
-- Weitere Mitarbeiter legst du danach in der App unter "Personal & PINs" an.

do $$
declare
  v_name text := 'Tomas';        -- Anzeigename im Login
  v_pin  text := 'HIER-PIN';     -- <-- ÄNDERN: nur Ziffern, z. B. 483920
begin
  if v_pin !~ '^\d{4,6}$' then
    raise exception 'Bitte oben bei v_pin einen PIN aus 4 bis 6 Ziffern eintragen.';
  end if;

  insert into public.staff (name, pin_hash, role, can_edit_recipes)
  values (v_name, extensions.crypt(v_pin, extensions.gen_salt('bf')), 'developer', true)
  on conflict (lower(name)) do update
    set pin_hash = excluded.pin_hash, role = 'developer', can_edit_recipes = true;
end $$;
