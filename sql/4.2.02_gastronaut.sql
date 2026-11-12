-- 4.2.02: Leserecht auf gastronaut_sync (Reservierungen aus Gastronaut) für die App.
-- Geschrieben wird nur vom Sync-Skript (service_role umgeht RLS).
alter table public.gastronaut_sync enable row level security;

drop policy if exists "gastronaut_sync_read" on public.gastronaut_sync;
create policy "gastronaut_sync_read" on public.gastronaut_sync
  for select to anon, authenticated using (true);
