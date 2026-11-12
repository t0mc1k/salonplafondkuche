-- Version 4.0.00: Verlauf im Schichttausch löschen (nur Manager/Developer)
-- Im Supabase SQL Editor ausführen. Ohne dieses SQL funktioniert alles andere weiter,
-- nur das Löschen im Verlauf meldet einen Fehler.
-- Voraussetzung: sql/3.2.03_betrieb.sql wurde schon ausgeführt.

drop policy if exists swaps_delete_admin on public.shift_swaps;
create policy swaps_delete_admin on public.shift_swaps
  for delete to public
  using (coalesce(public.is_staff_admin(), false));
