-- Version 3.1.01: Login-Protokoll leeren (nur Manager und Developer)
-- Im Supabase SQL Editor ausführen.

create or replace function public.admin_clear_login_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_staff_admin() then
    raise exception 'Keine Berechtigung';
  end if;

  delete from public.login_history where id is not null;
  get diagnostics n = row_count;
  return n;
end $$;
