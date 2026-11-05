-- LOCAL TEST ONLY (throwaway PostgreSQL, after 00_local_stub.sql and the migration).
-- Proves the Row Level Security policies keep users apart. Any failure raises an exception.
-- Run:  psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.test');

do $$
declare n int; failed boolean;
begin
  ---------------- User A creates a conversation and messages ----------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

  insert into public.conversations (id, title) values ('11111111-1111-1111-1111-111111111111', 'A secret chat');
  insert into public.messages (id, conversation_id, role, content)
    values ('a1a1a1a1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'hello from A');
  insert into public.messages (id, conversation_id, role, content)
    values ('a1a1a1a1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'assistant', 'hi A');

  select count(*) into n from public.conversations;
  assert n = 1, format('A should see 1 conversation, saw %s', n);
  select count(*) into n from public.messages;
  assert n = 2, format('A should see 2 messages, saw %s', n);
  assert (select user_id from public.conversations) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'user_id must default to the signed-in user';

  ---------------- User B sees nothing of A's data ----------------
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

  select count(*) into n from public.conversations;
  assert n = 0, format('B must not see A conversations, saw %s', n);
  select count(*) into n from public.messages;
  assert n = 0, format('B must not see A messages, saw %s', n);
  select count(*) into n from public.conversations where id = '11111111-1111-1111-1111-111111111111';
  assert n = 0, 'B must not read A conversation by guessing its id';

  -- B cannot update A's conversation (no row is visible, so 0 rows change)
  update public.conversations set title = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A conversation';

  -- B cannot delete A's conversation or messages
  delete from public.conversations where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A conversation';
  delete from public.messages where conversation_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A messages';

  -- B cannot add a message into A's conversation
  failed := false;
  begin
    insert into public.messages (conversation_id, role, content)
      values ('11111111-1111-1111-1111-111111111111', 'user', 'injected by B');
  exception when others then failed := true; end;
  assert failed, 'B must not insert a message into A conversation';

  -- B cannot create a conversation owned by A
  failed := false;
  begin
    insert into public.conversations (user_id, title) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'forged');
  exception when others then failed := true; end;
  assert failed, 'B must not create a conversation owned by A';

  -- B cannot hand a conversation of their own over to A
  insert into public.conversations (id, title) values ('22222222-2222-2222-2222-222222222222', 'B chat');
  failed := false;
  begin
    update public.conversations set user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      where id = '22222222-2222-2222-2222-222222222222';
  exception when others then failed := true; end;
  assert failed, 'B must not reassign a conversation to A';

  ---------------- Anonymous (not signed in) gets nothing ----------------
  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  failed := false;
  begin
    perform count(*) from public.conversations;
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon must have no access to conversations';
  failed := false;
  begin
    perform count(*) from public.messages;
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon must have no access to messages';

  ---------------- Owner can still delete; messages go with the conversation ----------------
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
  delete from public.conversations where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 1, 'A must be able to delete own conversation';
  reset role;
  select count(*) into n from public.messages where conversation_id = '11111111-1111-1111-1111-111111111111';
  assert n = 0, 'messages must be deleted with their conversation';

  raise notice 'RLS ISOLATION TESTS PASSED';
end $$;

rollback;
