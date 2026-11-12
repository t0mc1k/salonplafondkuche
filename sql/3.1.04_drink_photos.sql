-- Version 3.1.04: bis zu 3 Fotos pro Getränk
-- Im Supabase SQL Editor ausführen. Ohne dieses SQL speichert die App weiterhin das Hauptfoto,
-- weitere Fotos werden erst nach dem Ausführen gespeichert.

alter table public.drinks
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;

-- vorhandene Hauptfotos in die neue Liste übernehmen
update public.drinks
set photo_urls = jsonb_build_array(photo_url)
where coalesce(photo_url, '') <> '' and photo_urls = '[]'::jsonb;

-- Schutz: höchstens 3 Fotos pro Getränk (auch wenn jemand die App umgeht)
alter table public.drinks drop constraint if exists drinks_photo_urls_max3;
alter table public.drinks add constraint drinks_photo_urls_max3
  check (jsonb_typeof(photo_urls) = 'array' and jsonb_array_length(photo_urls) <= 3);
