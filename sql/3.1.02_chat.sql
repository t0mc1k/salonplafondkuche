-- Version 3.1.02: Team-Chat (Reaktionen, Bearbeiten, Fotos, Anpinnen)
-- Im Supabase SQL Editor ausführen. Ohne dieses SQL läuft der Chat weiter mit den Grundfunktionen.
-- (Beim Hinweis „Potential issue detected“ auf „Run query“ klicken.)

-- 1) neue Spalten für Nachrichten
alter table public.team_chat add column if not exists edited_at timestamptz;
alter table public.team_chat add column if not exists image_url text;
alter table public.team_chat add column if not exists is_pinned boolean not null default false;

-- 2) Reaktionen (👍 ❤️ 😂 ...)
create table if not exists public.chat_reactions (
  message_id uuid not null references public.team_chat(id) on delete cascade,
  user_name  text not null,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_name, emoji)
);
alter table public.chat_reactions enable row level security;
select public.reset_policies('chat_reactions');

create policy reactions_read on public.chat_reactions
  for select to public using (true);
create policy reactions_insert on public.chat_reactions
  for insert to public
  with check (public.current_staff_name() is not null
              and lower(user_name) = lower(public.current_staff_name()));
create policy reactions_delete on public.chat_reactions
  for delete to public
  using (lower(user_name) = lower(coalesce(public.current_staff_name(), '')));

-- 3) Nachrichten ändern: eigene Texte bearbeiten, Manager/Developer dürfen anpinnen
create policy chat_update_own on public.team_chat
  for update to public
  using (lower(author_name) = lower(coalesce(public.current_staff_name(), '')))
  with check (lower(author_name) = lower(coalesce(public.current_staff_name(), '')));
create policy chat_update_admin on public.team_chat
  for update to public
  using (public.is_staff_admin()) with check (public.is_staff_admin());

-- 4) Schutz: Autor, Zeit, Antwort-Bezug und Foto bleiben unveränderlich,
--    angepinnt wird nur von Manager/Developer, fremde Texte kann niemand ändern
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

-- 5) Echtzeit auch für Reaktionen
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reactions') then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;
