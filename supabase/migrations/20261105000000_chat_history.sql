-- chatLOL: conversation history (used by the app, requires Supabase Auth)
--
-- Re-runnable: tables/indexes use "if not exists" and policies are dropped and recreated.
-- Policy behaviour was tested on a local PostgreSQL with a Supabase-style auth.uid() stub
-- (see supabase/tests). It has NOT been run on your real Supabase project until you apply it.
--
-- IMPORTANT
--   * Apply this ONLY to a separate Supabase project created for chatLOL.
--     Never run it on the Blisscco Ad Network project or any production database.
--   * Rows belong to a signed-in user (user_id). There are NO policies for the anon role,
--     so nothing is publicly readable or writable. Row Level Security stays enabled.
--   * Never use the service_role key in the browser.

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'New chat' check (char_length(title) between 1 and 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null check (char_length(content) > 0),
  created_at       timestamptz not null default now()
);

-- Sidebar: a user's conversations, newest first
create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- Open a conversation: its messages in order
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at, id);

-- Keep conversations.updated_at fresh whenever a message is added
create or replace function public.touch_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Row Level Security (stays ON)
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- No access for anonymous visitors
revoke all on public.conversations from anon;
revoke all on public.messages      from anon;

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, delete          on public.messages      to authenticated;

-- conversations: owner only
drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own on public.conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- messages: only inside conversations the user owns
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = (select auth.uid())));
drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated with check (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = (select auth.uid())));
drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = (select auth.uid())));
