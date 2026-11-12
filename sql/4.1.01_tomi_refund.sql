-- Version 4.1.01: Fehlgeschlagene TomiAI-Anfragen (z. B. Google überlastet) zählen nicht zum Tageslimit
-- Im Supabase SQL Editor ausführen (optional, aber empfohlen). Voraussetzung: sql/4.1.00_push_tomi.sql.
-- Die Funktion kann nur die Edge Function (service_role) aufrufen, nicht die App.

create or replace function public.tomi_refund(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tomi_usage
     set n = greatest(n - 1, 0)
   where staff_name = lower(coalesce(p_name, '')) and day = current_date;
end $$;

revoke all on function public.tomi_refund(text) from public, anon, authenticated;
grant execute on function public.tomi_refund(text) to service_role;
