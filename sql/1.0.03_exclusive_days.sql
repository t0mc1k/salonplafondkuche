-- Version 1.0.03 (Küche): Exklusiv-Schicht pro Tag im Dienstplan
-- Im Supabase SQL Editor ausführen (nach 1.0.02_workplan.sql).
-- plan_weeks.exclusive_days: Tage der Woche mit Exklusiv-Schicht, 0 = Montag ... 6 = Sonntag.
-- Sichtbar für alle, sobald die Woche veröffentlicht ist (gleiche Regeln wie plan_weeks).

alter table public.plan_weeks add column if not exists exclusive_days smallint[] not null default '{}';
