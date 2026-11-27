-- Apply AFTER the frontend that uses add_friend_by_code is live: older builds list every user in New Chat.
-- A signed-in user can now read only their own row and the rows of people they share a chat with.
create function public.shares_chat_with(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from participants a join participants b on a.conversation_id = b.conversation_id
    where a.user_id = auth.uid() and b.user_id = uid)
$$;
revoke execute on function public.shares_chat_with(uuid) from public, anon;
grant execute on function public.shares_chat_with(uuid) to authenticated;

drop policy "users readable" on public.users;
create policy "users visible to self and chat partners" on public.users for select to authenticated
  using (id = auth.uid() or public.shares_chat_with(id));
