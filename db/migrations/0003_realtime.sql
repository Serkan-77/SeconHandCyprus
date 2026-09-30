-- Realtime events (replaces the supabase_realtime publication).
--
-- Triggers send a small JSON payload on the 'app_events' channel when a
-- message, a read receipt, a meeting confirmation or a notification is
-- written. pg_notify is transactional: nothing is sent for a rolled-back write.
-- The API LISTENs on one connection and pushes each event only to the
-- WebSocket connections of the users named in "users", which the database
-- computed from the conversation row itself. Clients never choose what they
-- subscribe to, so they cannot listen to someone else's conversation.
--
-- Payloads carry ids only (pg_notify is limited to 8000 bytes); the API reads
-- the row before forwarding it.

create or replace function app.emit(payload jsonb)
returns void language sql volatile as $$
  select pg_notify('app_events', payload::text)
$$;

-- The non-null ids among a and b, as a JSON array.
create or replace function app.users_json(a uuid, b uuid)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from unnest(array[a, b]) as x where x is not null
$$;

create or replace function app.on_message_event()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  conv conversations%rowtype;
begin
  select * into conv from conversations where id = new.conversation_id;
  perform app.emit(jsonb_build_object(
    't', 'message', 'c', new.conversation_id, 'id', new.id,
    'users', app.users_json(conv.buyer_id, conv.seller_id)));
  return null;
end $$;

create trigger zz_realtime_message after insert on public.messages
  for each row execute function app.on_message_event();

create or replace function app.on_messages_read()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  r record;
begin
  for r in
    select n.conversation_id, max(n.read_at) as read_at, c.buyer_id, c.seller_id
    from new_rows n
    join old_rows o on o.id = n.id
    join conversations c on c.id = n.conversation_id
    where n.read_at is not null and o.read_at is null
    group by n.conversation_id, c.buyer_id, c.seller_id
  loop
    perform app.emit(jsonb_build_object(
      't', 'read', 'c', r.conversation_id, 'at', r.read_at,
      'users', app.users_json(r.buyer_id, r.seller_id)));
  end loop;
  return null;
end $$;

create trigger zz_realtime_read after update on public.messages
  referencing new table as new_rows old table as old_rows
  for each statement execute function app.on_messages_read();

create or replace function app.on_conversation_event()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
     or new.seller_confirmed_at is distinct from old.seller_confirmed_at then
    perform app.emit(jsonb_build_object(
      't', 'conversation', 'c', new.id,
      'users', app.users_json(new.buyer_id, new.seller_id)));
  end if;
  return null;
end $$;

create trigger zz_realtime_conversation after update on public.conversations
  for each row execute function app.on_conversation_event();

create or replace function app.on_notification_event()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  perform app.emit(jsonb_build_object('t', 'notification', 'id', new.id, 'users', jsonb_build_array(new.user_id)));
  return null;
end $$;

create trigger zz_realtime_notification after insert on public.notifications
  for each row execute function app.on_notification_event();

revoke execute on function app.on_message_event() from public;
revoke execute on function app.on_messages_read() from public;
revoke execute on function app.on_conversation_event() from public;
revoke execute on function app.on_notification_event() from public;
