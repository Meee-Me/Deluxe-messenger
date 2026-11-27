-- Whispers: a 1-on-1 message the recipient reads once. Opening it wipes the ciphertext for both people.
-- The server can see that a message is a whisper (the `once` flag) but never what it says.
alter table public.messages add column once boolean not null default false, add column burned_at timestamptz;

-- Clients may set `once` when sending, but never burned_at.
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, ciphertext, nonce, keys, once) on public.messages to authenticated;

-- Only the recipient of a whisper in a 1-on-1 chat can burn it, and only once.
create function public.burn_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update messages m set ciphertext = '', nonce = '', keys = '{}'::jsonb, burned_at = now()
  where m.id = p_id and m.once and m.burned_at is null and m.sender_id <> auth.uid()
    and public.is_participant(m.conversation_id)
    and exists (select 1 from conversations c where c.id = m.conversation_id and not c.is_group);
  if not found then raise exception 'nothing to burn'; end if;
end $$;
revoke execute on function public.burn_message(uuid) from public, anon;
grant execute on function public.burn_message(uuid) to authenticated;
