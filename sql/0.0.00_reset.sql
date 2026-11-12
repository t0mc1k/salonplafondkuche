-- !!! NEVRATNE: zmaže VŠETKO v schéme public (tabuľky, funkcie, dáta) !!!
-- Spúšťať iba v kuchynskom projekte (jhirewwpsehqrmbnuspt), NIKDY v bar projekte.
-- Potom spustiť sql/1.0.00_init.sql.

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables    to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
